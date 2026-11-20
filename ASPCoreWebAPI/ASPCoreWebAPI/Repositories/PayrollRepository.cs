using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public interface IPayrollRepository
    {
        Task<bool> RunExistsAsync(int month, int year);
        Task<long> CreateRunWithJobAsync(int month, int year, int createdBy, string jobType);
        Task<List<PayrollRunDto>> GetRunsAsync();
        Task<PayrollRunDto?> GetRunAsync(long id);
        Task<bool> ApproveRunAsync(long id, int userId, DateTime at);
        Task<bool> PublishRunAsync(long id, DateTime at);
        Task<int> CountPayslipsAsync(long runId);

        Task<long?> GetActiveRunJobIdAsync(long runId, string jobType);
        Task<long?> EnqueueRunJobAsync(long runId, string jobType);
        Task<List<PayrollJob>> GetJobsForRunAsync(long runId);
        Task<PayrollJob?> ClaimNextJobAsync();
        Task MarkJobSucceededAsync(long jobId);
        Task MarkJobFailedAsync(long jobId, string error, bool retry);

        Task<List<PayrollEmployeeRow>> GetPayrollEmployeesAsync(DateTime cutoff);
        Task<List<Attendance>> GetAttendanceAsync(DateTime start, DateTime end);
        Task<List<Leave>> GetApprovedLeavesAsync(DateTime start, DateTime end);
        Task<List<PayrollAdjustmentRow>> GetRunAdjustmentsAsync(long runId);
        Task<List<DeductionRule>> GetDeductionRulesAsync();
        Task<List<PayrollHoliday>> GetHolidaysAsync(int? year);
        Task<List<PayrollWeekOffDay>> GetWeekOffDaysAsync();

        Task UpsertPayslipAsync(
            long runId,
            int employeeId,
            int version,
            decimal gross,
            decimal lopDays,
            decimal lopAmount,
            decimal adjustments,
            decimal totalDeductions,
            decimal netPay,
            string itemsJson,
            string warningsJson);

        Task<(List<PayslipSummaryDto> Items, int Total)> GetPayslipSummariesAsync(
            long runId,
            string? search,
            string? status,
            int page,
            int pageSize);

        Task<Payslip?> GetPayslipAsync(long id);
        Task<List<PayslipSummaryDto>> GetEmployeePayslipsAsync(int employeeId, int? year);
        Task<Payslip?> GetEmployeePayslipAsync(long id, int employeeId);
        Task<Payslip?> GetLatestEmployeePayslipAsync(int employeeId);
        Task<Payslip?> GetLatestPayslipAsync(long runId, int employeeId);
        Task<Payslip?> ReissuePayslipAsync(long sourcePayslipId);
        Task<List<PayslipSummaryDto>> GetPayslipVersionsAsync(long runId, int employeeId);
        Task<PayslipNotificationRow?> GetPayslipNotificationAsync(long payslipId);
        Task UpdatePayslipPdfPathAsync(long payslipId, string pdfPath);
        Task<PayslipAdjustment?> CreateAdjustmentAsync(
            long payslipId,
            string type,
            decimal amount,
            string? note,
            int userId);

        Task<List<SalaryStructure>> GetSalaryStructuresAsync(int? employeeId);
        Task<SalaryStructure?> GetSalaryStructureAsync(long id);
        Task<SalaryStructure> CreateSalaryStructureAsync(SalaryStructure structure);
        Task<bool> EmployeeExistsAsync(int employeeId);

        Task<DeductionRule> CreateDeductionRuleAsync(DeductionRule rule);
        Task<DeductionRule?> UpdateDeductionRuleAsync(long id, DeductionRule rule);
        Task<bool> DeductionRuleNameExistsAsync(string name, long? excludeId);

        Task<PayrollHoliday> CreateHolidayAsync(DateTime date, string name, int userId);
        Task<bool> DeleteHolidayAsync(long id);
        Task<bool> HolidayExistsAsync(DateTime date);

        Task ReplaceWeekOffDaysAsync(int[] days);
        Task AddAuditAsync(int? userId, string action, string entity, long? entityId, string details);
    }

    public class PayrollRepository : IPayrollRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public PayrollRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string RunSelect = @"
            SELECT r.id              AS ""Id"",
                   r.month           AS ""Month"",
                   r.year            AS ""Year"",
                   r.status          AS ""Status"",
                   r.created_by      AS ""CreatedBy"",
                   r.approved_by     AS ""ApprovedBy"",
                   r.approved_at     AS ""ApprovedAt"",
                   r.published_at    AS ""PublishedAt"",
                   r.created_at      AS ""CreatedAt"",
                   COUNT(p.id)::int  AS ""EmployeeCount"",
                   COALESCE(SUM(p.gross), 0)            AS ""TotalGross"",
                   COALESCE(SUM(p.total_deductions), 0) AS ""TotalDeductions"",
                   COALESCE(SUM(p.net_pay), 0)          AS ""NetPayout"",
                   COALESCE(SUM(jsonb_array_length(p.warnings)), 0)::int AS ""WarningsCount""
               FROM payroll_runs r
               LEFT JOIN payslips p ON p.run_id = r.id
                 AND p.version = (
                     SELECT MAX(p2.version)
                       FROM payslips p2
                      WHERE p2.run_id = p.run_id
                        AND p2.employee_id = p.employee_id)";

        private const string PayslipSummarySelect = @"
            SELECT p.id                AS ""Id"",
                   p.run_id            AS ""RunId"",
                   p.employee_id       AS ""EmployeeId"",
                   COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                            u.""Email"", e.""EmployeeCode"", 'Unknown') AS ""EmployeeName"",
                   e.""EmployeeCode""  AS ""EmployeeCode"",
                   r.month             AS ""Month"",
                   r.year              AS ""Year"",
                   p.version           AS ""Version"",
                   p.gross             AS ""Gross"",
                   p.lop_days          AS ""LopDays"",
                   p.total_deductions  AS ""TotalDeductions"",
                   p.net_pay           AS ""NetPay"",
                   p.status            AS ""Status"",
                   COALESCE(jsonb_array_length(p.warnings), 0)::int AS ""WarningsCount""
              FROM payslips p
              JOIN payroll_runs r ON r.id = p.run_id
              JOIN ""Employees"" e ON e.""Id"" = p.employee_id
              LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""";

        private const string PayslipSelect = @"
            SELECT p.id              AS ""Id"",
                   p.run_id          AS ""RunId"",
                   p.employee_id     AS ""EmployeeId"",
                   p.version         AS ""Version"",
                   p.gross           AS ""Gross"",
                   p.lop_days        AS ""LopDays"",
                   p.lop_amount      AS ""LopAmount"",
                   p.adjustments     AS ""Adjustments"",
                   p.total_deductions AS ""TotalDeductions"",
                   p.net_pay         AS ""NetPay"",
                   p.items::text     AS ""Items"",
                   p.warnings::text  AS ""Warnings"",
                   p.status          AS ""Status"",
                   p.pdf_path        AS ""PdfPath"",
                   p.created_at      AS ""CreatedAt"",
                   r.month           AS ""Month"",
                   r.year            AS ""Year"",
                   COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                            u.""Email"", e.""EmployeeCode"", 'Unknown') AS ""EmployeeName"",
                   e.""EmployeeCode"" AS ""EmployeeCode"",
                   des.""Title""     AS ""DesignationTitle""
              FROM payslips p
              JOIN payroll_runs r ON r.id = p.run_id
              JOIN ""Employees"" e ON e.""Id"" = p.employee_id
              LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""
              LEFT JOIN ""Designations"" des ON des.""Id"" = e.""DesignationId""";

        private const string SalaryStructureSelect = @"
            SELECT s.id            AS ""Id"",
                   s.employee_id   AS ""EmployeeId"",
                   s.basic         AS ""Basic"",
                   s.hra           AS ""Hra"",
                   s.allowances    AS ""Allowances"",
                   s.effective_from::timestamp AS ""EffectiveFrom"",
                   s.created_by    AS ""CreatedBy"",
                   s.created_at    AS ""CreatedAt"",
                   COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                            u.""Email"", e.""EmployeeCode"", 'Unknown') AS ""EmployeeName"",
                   e.""EmployeeCode"" AS ""EmployeeCode""
              FROM salary_structures s
              JOIN ""Employees"" e ON e.""Id"" = s.employee_id
              LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""";

        public async Task<bool> RunExistsAsync(int month, int year)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<bool>(
                "SELECT COUNT(*) > 0 FROM payroll_runs WHERE month = @Month AND year = @Year",
                new { Month = month, Year = year });
        }

        public async Task<long> CreateRunWithJobAsync(int month, int year, int createdBy, string jobType)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var runId = await connection.ExecuteScalarAsync<long>(
                    @"INSERT INTO payroll_runs (month, year, status, created_by)
                      VALUES (@Month, @Year, 'DRAFT', @CreatedBy)
                      RETURNING id",
                    new { Month = month, Year = year, CreatedBy = createdBy },
                    transaction);

                await connection.ExecuteAsync(
                    @"INSERT INTO payroll_jobs (type, run_id, status)
                      VALUES (@Type, @RunId, 'QUEUED')",
                    new { Type = jobType, RunId = runId },
                    transaction);

                await transaction.CommitAsync();
                return runId;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<List<PayrollRunDto>> GetRunsAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayrollRunDto>(
                $@"{RunSelect}
                   GROUP BY r.id
                   ORDER BY r.year DESC, r.month DESC, r.id DESC");
            return rows.ToList();
        }

        public async Task<PayrollRunDto?> GetRunAsync(long id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<PayrollRunDto>(
                $@"{RunSelect}
                   WHERE r.id = @Id
                   GROUP BY r.id",
                new { Id = id });
        }

        public async Task<bool> ApproveRunAsync(long id, int userId, DateTime at)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var updated = await connection.ExecuteAsync(
                @"UPDATE payroll_runs
                     SET status = 'APPROVED', approved_by = @UserId, approved_at = @At
                   WHERE id = @Id AND status = 'DRAFT'",
                new { Id = id, UserId = userId, At = at });

            return updated > 0;
        }

        public async Task<bool> PublishRunAsync(long id, DateTime at)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var updated = await connection.ExecuteAsync(
                    @"UPDATE payroll_runs
                         SET status = 'PUBLISHED', published_at = @At
                       WHERE id = @Id AND status = 'APPROVED'",
                    new { Id = id, At = at },
                    transaction);

                if (updated == 0)
                {
                    await transaction.RollbackAsync();
                    return false;
                }

                await connection.ExecuteAsync(
                    @"UPDATE payslips SET status = 'PUBLISHED' WHERE run_id = @Id",
                    new { Id = id },
                    transaction);

                await connection.ExecuteAsync(
                    @"INSERT INTO payroll_jobs (type, run_id, payslip_id, status)
                      SELECT 'GENERATE_PDF', p.run_id, p.id, 'QUEUED'
                        FROM payslips p
                       WHERE p.run_id = @Id
                         AND p.version = (
                             SELECT MAX(p2.version)
                               FROM payslips p2
                              WHERE p2.run_id = p.run_id
                                AND p2.employee_id = p.employee_id)
                         AND NOT EXISTS (
                             SELECT 1
                               FROM payroll_jobs j
                              WHERE j.payslip_id = p.id
                                AND j.type = 'GENERATE_PDF'
                                AND j.status IN ('QUEUED', 'RUNNING', 'RETRYING'))",
                    new { Id = id },
                    transaction);

                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<int> CountPayslipsAsync(long runId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*)::int FROM payslips WHERE run_id = @RunId",
                new { RunId = runId });
        }

        public async Task<long?> GetActiveRunJobIdAsync(long runId, string jobType)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<long?>(
                @"SELECT id
                    FROM payroll_jobs
                   WHERE run_id = @RunId
                     AND type = @Type
                     AND status IN ('QUEUED', 'RUNNING', 'RETRYING')
                   ORDER BY id DESC
                   LIMIT 1",
                new { RunId = runId, Type = jobType });
        }

        public async Task<long?> EnqueueRunJobAsync(long runId, string jobType)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                await connection.ExecuteAsync(
                    "SELECT pg_advisory_xact_lock(@Key)",
                    new { Key = runId },
                    transaction);

                var existing = await connection.QuerySingleOrDefaultAsync<long?>(
                    @"SELECT id
                        FROM payroll_jobs
                       WHERE run_id = @RunId
                         AND type = @Type
                         AND status IN ('QUEUED', 'RUNNING', 'RETRYING')
                       ORDER BY id DESC
                       LIMIT 1",
                    new { RunId = runId, Type = jobType },
                    transaction);

                if (existing.HasValue)
                {
                    await transaction.CommitAsync();
                    return existing;
                }

                var jobId = await connection.ExecuteScalarAsync<long>(
                    @"INSERT INTO payroll_jobs (type, run_id, status)
                      VALUES (@Type, @RunId, 'QUEUED')
                      RETURNING id",
                    new { Type = jobType, RunId = runId },
                    transaction);

                await transaction.CommitAsync();
                return jobId;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<List<PayrollJob>> GetJobsForRunAsync(long runId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayrollJob>(
                @"SELECT id          AS ""Id"",
                         type        AS ""Type"",
                         run_id      AS ""RunId"",
                         payslip_id  AS ""PayslipId"",
                         status      AS ""Status"",
                         attempts    AS ""Attempts"",
                         error       AS ""Error"",
                         created_at  AS ""CreatedAt"",
                         updated_at  AS ""UpdatedAt""
                    FROM payroll_jobs
                   WHERE run_id = @RunId
                   ORDER BY id DESC",
                new { RunId = runId });
            return rows.ToList();
        }

        public async Task<PayrollJob?> ClaimNextJobAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var job = await connection.QuerySingleOrDefaultAsync<PayrollJob>(
                    @"UPDATE payroll_jobs AS j
                         SET status = 'RUNNING',
                             attempts = j.attempts + 1,
                             updated_at = NOW()
                        FROM (
                            SELECT id
                              FROM payroll_jobs
                             WHERE status IN ('QUEUED', 'RETRYING')
                               AND type IN ('CALCULATE_RUN', 'GENERATE_PDF')
                             ORDER BY CASE WHEN type = 'CALCULATE_RUN' THEN 0 ELSE 1 END,
                                      created_at,
                                      id
                             FOR UPDATE SKIP LOCKED
                             LIMIT 1
                        ) AS picked
                       WHERE j.id = picked.id
                       RETURNING j.id         AS ""Id"",
                                 j.type       AS ""Type"",
                                 j.run_id     AS ""RunId"",
                                 j.payslip_id AS ""PayslipId"",
                                 j.status     AS ""Status"",
                                 j.attempts   AS ""Attempts"",
                                 j.error      AS ""Error"",
                                 j.created_at AS ""CreatedAt"",
                                 j.updated_at AS ""UpdatedAt""",
                    transaction: transaction);

                await transaction.CommitAsync();
                return job;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task MarkJobSucceededAsync(long jobId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"UPDATE payroll_jobs
                     SET status = 'SUCCEEDED', error = NULL, updated_at = NOW()
                   WHERE id = @Id",
                new { Id = jobId });
        }

        public async Task MarkJobFailedAsync(long jobId, string error, bool retry)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var message = error.Length > 2000 ? error[..2000] : error;

            await connection.ExecuteAsync(
                @"UPDATE payroll_jobs
                     SET status = @Status, error = @Error, updated_at = NOW()
                   WHERE id = @Id",
                new
                {
                    Id = jobId,
                    Status = retry ? PayrollJobStatuses.Retrying : PayrollJobStatuses.Failed,
                    Error = message
                });
        }

        public async Task<List<PayrollEmployeeRow>> GetPayrollEmployeesAsync(DateTime cutoff)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayrollEmployeeRow>(
                @"SELECT e.""Id""           AS ""EmployeeId"",
                         COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                                  u.""Email"", e.""EmployeeCode"", 'Unknown') AS ""EmployeeName"",
                         e.""EmployeeCode"" AS ""EmployeeCode"",
                         e.""JoiningDate""::timestamp AS ""JoiningDate"",
                         s.id             AS ""SalaryStructureId"",
                         s.basic          AS ""Basic"",
                         s.hra            AS ""Hra"",
                         s.allowances     AS ""Allowances"",
                         s.effective_from::timestamp AS ""EffectiveFrom""
                    FROM ""Employees"" e
                    LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""
                    LEFT JOIN LATERAL (
                        SELECT ss.id, ss.basic, ss.hra, ss.allowances, ss.effective_from
                          FROM salary_structures ss
                         WHERE ss.employee_id = e.""Id""
                           AND ss.effective_from <= @Cutoff::date
                         ORDER BY ss.effective_from DESC, ss.id DESC
                         LIMIT 1
                    ) s ON TRUE
                   WHERE LOWER(e.""Status"") = 'active'
                     AND (e.""JoiningDate"" IS NULL OR e.""JoiningDate""::date <= @Cutoff::date)
                   ORDER BY e.""Id""",
                new { Cutoff = cutoff });
            return rows.ToList();
        }

        public async Task<List<Attendance>> GetAttendanceAsync(DateTime start, DateTime end)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<Attendance>(
                @"SELECT a.id              AS ""Id"",
                         a.employee_id     AS ""EmployeeId"",
                         a.attendance_date::timestamp AS ""AttendanceDate"",
                         a.status::text    AS ""Status"",
                         a.updated_at      AS ""UpdatedAt""
                    FROM attendance a
                   WHERE a.attendance_date >= @Start::date
                     AND a.attendance_date <= @End::date",
                new { Start = start, End = end });
            return rows.ToList();
        }

        public async Task<List<Leave>> GetApprovedLeavesAsync(DateTime start, DateTime end)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<Leave>(
                @"SELECT l.""Id""         AS ""Id"",
                         l.""EmployeeId"" AS ""EmployeeId"",
                         l.""LeaveType""  AS ""LeaveType"",
                         l.""StartDate""::timestamp AS ""StartDate"",
                         l.""EndDate""::timestamp   AS ""EndDate"",
                         l.""Status""     AS ""Status"",
                         l.""Days""       AS ""Days""
                    FROM ""Leaves"" l
                   WHERE LOWER(l.""Status"") = 'approved'
                     AND l.""StartDate""::date <= @End::date
                     AND l.""EndDate""::date >= @Start::date",
                new { Start = start, End = end });
            return rows.ToList();
        }

        public async Task<List<PayrollAdjustmentRow>> GetRunAdjustmentsAsync(long runId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayrollAdjustmentRow>(
                @"SELECT pa.id         AS ""Id"",
                         pa.payslip_id AS ""PayslipId"",
                         p.employee_id AS ""EmployeeId"",
                         pa.type       AS ""Type"",
                         pa.amount     AS ""Amount"",
                         pa.note       AS ""Note"",
                         pa.created_by AS ""CreatedBy"",
                         pa.created_at AS ""CreatedAt""
                    FROM payslip_adjustments pa
                    JOIN payslips p ON p.id = pa.payslip_id
                   WHERE p.run_id = @RunId
                     AND p.version = 1
                   ORDER BY pa.id",
                new { RunId = runId });
            return rows.ToList();
        }

        public async Task<List<DeductionRule>> GetDeductionRulesAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<DeductionRule>(
                @"SELECT id         AS ""Id"",
                         name       AS ""Name"",
                         type       AS ""Type"",
                         value      AS ""Value"",
                         is_active  AS ""IsActive"",
                         created_at AS ""CreatedAt""
                    FROM deduction_rules
                   ORDER BY LOWER(name)");
            return rows.ToList();
        }

        public async Task<List<PayrollHoliday>> GetHolidaysAsync(int? year)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayrollHoliday>(
                @"SELECT id           AS ""Id"",
                         holiday_date::timestamp AS ""HolidayDate"",
                         name         AS ""Name"",
                         created_by   AS ""CreatedBy"",
                         created_at   AS ""CreatedAt""
                    FROM payroll_holidays
                   WHERE (@Year::int IS NULL OR EXTRACT(YEAR FROM holiday_date) = @Year)
                   ORDER BY holiday_date",
                new { Year = year });
            return rows.ToList();
        }

        public async Task<List<PayrollWeekOffDay>> GetWeekOffDaysAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayrollWeekOffDay>(
                @"SELECT day_of_week AS ""DayOfWeek""
                    FROM payroll_week_off_days
                   ORDER BY day_of_week");
            return rows.ToList();
        }

        public async Task UpsertPayslipAsync(
            long runId,
            int employeeId,
            int version,
            decimal gross,
            decimal lopDays,
            decimal lopAmount,
            decimal adjustments,
            decimal totalDeductions,
            decimal netPay,
            string itemsJson,
            string warningsJson)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"INSERT INTO payslips
                      (run_id, employee_id, version, gross, lop_days, lop_amount, adjustments,
                       total_deductions, net_pay, items, warnings, status)
                  VALUES
                      (@RunId, @EmployeeId, @Version, @Gross, @LopDays, @LopAmount, @Adjustments,
                       @TotalDeductions, @NetPay, @Items::jsonb, @Warnings::jsonb, 'DRAFT')
                  ON CONFLICT (run_id, employee_id, version) DO UPDATE
                     SET gross = EXCLUDED.gross,
                         lop_days = EXCLUDED.lop_days,
                         lop_amount = EXCLUDED.lop_amount,
                         adjustments = EXCLUDED.adjustments,
                         total_deductions = EXCLUDED.total_deductions,
                         net_pay = EXCLUDED.net_pay,
                         items = EXCLUDED.items,
                         warnings = EXCLUDED.warnings,
                         status = 'DRAFT',
                         pdf_path = NULL",
                new
                {
                    RunId = runId,
                    EmployeeId = employeeId,
                    Version = version,
                    Gross = gross,
                    LopDays = lopDays,
                    LopAmount = lopAmount,
                    Adjustments = adjustments,
                    TotalDeductions = totalDeductions,
                    NetPay = netPay,
                    Items = itemsJson,
                    Warnings = warningsJson
                });
        }

        public async Task<(List<PayslipSummaryDto> Items, int Total)> GetPayslipSummariesAsync(
            long runId,
            string? search,
            string? status,
            int page,
            int pageSize)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var where = new List<string>
            {
                "p.run_id = @RunId",
                @"p.version = (
                    SELECT MAX(p2.version)
                      FROM payslips p2
                     WHERE p2.run_id = p.run_id
                       AND p2.employee_id = p.employee_id)"
            };
            var parameters = new DynamicParameters();
            parameters.Add("RunId", runId);

            if (!string.IsNullOrWhiteSpace(status))
            {
                where.Add("p.status = @Status");
                parameters.Add("Status", status);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                where.Add(@"(u.""FirstName"" ILIKE @Search
                         OR u.""LastName"" ILIKE @Search
                         OR (u.""FirstName"" || ' ' || u.""LastName"") ILIKE @Search
                         OR u.""Email"" ILIKE @Search
                         OR e.""EmployeeCode"" ILIKE @Search)");
                parameters.Add("Search", "%" + EscapeLike(search.Trim()) + "%");
            }

            var whereSql = " WHERE " + string.Join(" AND ", where);
            var fromSql = @"
                FROM payslips p
                JOIN payroll_runs r ON r.id = p.run_id
                JOIN ""Employees"" e ON e.""Id"" = p.employee_id
                LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""";

            var total = await connection.ExecuteScalarAsync<int>(
                $"SELECT COUNT(*)::int {fromSql}{whereSql}",
                parameters);

            parameters.Add("Limit", pageSize);
            parameters.Add("Offset", (page - 1) * pageSize);

            var rows = await connection.QueryAsync<PayslipSummaryDto>(
                $@"{PayslipSummarySelect}{whereSql}
                   ORDER BY u.""FirstName"" NULLS LAST, u.""LastName"" NULLS LAST, e.""EmployeeCode"", p.id
                   LIMIT @Limit OFFSET @Offset",
                parameters);

            return (rows.ToList(), total);
        }

        public async Task<Payslip?> GetPayslipAsync(long id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Payslip>(
                $@"{PayslipSelect} WHERE p.id = @Id",
                new { Id = id });
        }

        public async Task<List<PayslipSummaryDto>> GetEmployeePayslipsAsync(
            int employeeId,
            int? year)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var where = new List<string>
            {
                "p.employee_id = @EmployeeId",
                "p.status = 'PUBLISHED'",
                "r.status = 'PUBLISHED'",
                @"p.version = (
                    SELECT MAX(p2.version)
                      FROM payslips p2
                     WHERE p2.run_id = p.run_id
                       AND p2.employee_id = p.employee_id)"
            };
            var parameters = new DynamicParameters();
            parameters.Add("EmployeeId", employeeId);

            if (year.HasValue)
            {
                where.Add("r.year = @Year");
                parameters.Add("Year", year.Value);
            }
            var rows = await connection.QueryAsync<PayslipSummaryDto>(
                $@"{PayslipSummarySelect}
                   WHERE {string.Join(" AND ", where)}
                   ORDER BY r.year DESC, r.month DESC, p.id DESC",
                parameters);
            return rows.ToList();
        }

        public async Task<Payslip?> GetEmployeePayslipAsync(long id, int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Payslip>(
                $@"{PayslipSelect}
                   WHERE p.id = @Id
                     AND p.employee_id = @EmployeeId
                     AND p.status = 'PUBLISHED'
                     AND r.status = 'PUBLISHED'",
                new { Id = id, EmployeeId = employeeId });
        }

        public async Task<Payslip?> GetLatestEmployeePayslipAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Payslip>(
                $@"{PayslipSelect}
                   WHERE p.employee_id = @EmployeeId
                     AND p.status = 'PUBLISHED'
                     AND r.status = 'PUBLISHED'
                   ORDER BY r.year DESC, r.month DESC, p.version DESC
                   LIMIT 1",
                new { EmployeeId = employeeId });
        }

        public async Task<Payslip?> GetLatestPayslipAsync(long runId, int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Payslip>(
                $@"{PayslipSelect}
                   WHERE p.run_id = @RunId
                     AND p.employee_id = @EmployeeId
                   ORDER BY p.version DESC
                   LIMIT 1",
                new { RunId = runId, EmployeeId = employeeId });
        }

        public async Task<Payslip?> ReissuePayslipAsync(long sourcePayslipId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var source = await connection.QuerySingleOrDefaultAsync<Payslip>(
                    @"SELECT p.run_id      AS ""RunId"",
                             p.employee_id AS ""EmployeeId"",
                             p.version     AS ""Version""
                        FROM payslips p
                        JOIN payroll_runs r ON r.id = p.run_id
                       WHERE p.id = @Id
                         AND p.status = 'PUBLISHED'
                         AND r.status = 'PUBLISHED'
                       FOR UPDATE OF p",
                    new { Id = sourcePayslipId },
                    transaction);

                if (source is null)
                {
                    await transaction.RollbackAsync();
                    return null;
                }

                var latestVersion = await connection.ExecuteScalarAsync<int>(
                    @"SELECT COALESCE(MAX(version), 0)
                        FROM payslips
                       WHERE run_id = @RunId
                         AND employee_id = @EmployeeId",
                    new { source.RunId, source.EmployeeId },
                    transaction);

                if (source.Version != latestVersion)
                {
                    await transaction.RollbackAsync();
                    return null;
                }

                var nextVersion = latestVersion + 1;
                var newId = await connection.ExecuteScalarAsync<long>(
                    @"INSERT INTO payslips
                          (run_id, employee_id, version, gross, lop_days, lop_amount,
                           adjustments, total_deductions, net_pay, items, warnings,
                           status, pdf_path)
                      SELECT run_id, employee_id, @NextVersion, gross, lop_days, lop_amount,
                             adjustments, total_deductions, net_pay, items, warnings,
                             'PUBLISHED', NULL
                        FROM payslips
                       WHERE id = @SourceId
                      RETURNING id",
                    new
                    {
                        SourceId = sourcePayslipId,
                        NextVersion = nextVersion
                    },
                    transaction);

                await connection.ExecuteAsync(
                    @"INSERT INTO payroll_jobs (type, run_id, payslip_id, status)
                      VALUES ('GENERATE_PDF', @RunId, @PayslipId, 'QUEUED')",
                    new { source.RunId, PayslipId = newId },
                    transaction);

                await transaction.CommitAsync();
                return await GetPayslipAsync(newId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<List<PayslipSummaryDto>> GetPayslipVersionsAsync(
            long runId,
            int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayslipSummaryDto>(
                $@"{PayslipSummarySelect}
                   WHERE p.run_id = @RunId
                     AND p.employee_id = @EmployeeId
                   ORDER BY p.version DESC",
                new { RunId = runId, EmployeeId = employeeId });
            return rows.ToList();
        }

        public async Task<PayslipNotificationRow?> GetPayslipNotificationAsync(
            long payslipId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<PayslipNotificationRow>(
                @"SELECT p.id          AS ""PayslipId"",
                         p.employee_id AS ""EmployeeId"",
                         e.""UserId""   AS ""UserId"",
                         COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                                  u.""Email"", e.""EmployeeCode"", 'Unknown') AS ""EmployeeName"",
                         e.""EmployeeCode"" AS ""EmployeeCode"",
                         r.month       AS ""Month"",
                         r.year        AS ""Year"",
                         p.version     AS ""Version"",
                         p.status      AS ""Status"",
                         (p.version = (
                             SELECT MAX(p2.version)
                               FROM payslips p2
                              WHERE p2.run_id = p.run_id
                                AND p2.employee_id = p.employee_id)) AS ""IsLatest""
                    FROM payslips p
                    JOIN payroll_runs r ON r.id = p.run_id
                    JOIN ""Employees"" e ON e.""Id"" = p.employee_id
                    LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""
                   WHERE p.id = @Id",
                new { Id = payslipId });
        }

        public async Task UpdatePayslipPdfPathAsync(long payslipId, string pdfPath)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"UPDATE payslips
                     SET pdf_path = @PdfPath
                   WHERE id = @Id",
                new { Id = payslipId, PdfPath = pdfPath });
        }

        public async Task<PayslipAdjustment?> CreateAdjustmentAsync(
            long payslipId,
            string type,
            decimal amount,
            string? note,
            int userId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<PayslipAdjustment>(
                @"INSERT INTO payslip_adjustments (payslip_id, type, amount, note, created_by)
                  SELECT @PayslipId, @Type, @Amount, @Note, @CreatedBy
                   WHERE EXISTS (
                       SELECT 1
                         FROM payslips p
                         JOIN payroll_runs r ON r.id = p.run_id
                        WHERE p.id = @PayslipId
                          AND r.status = 'DRAFT'
                   )
                  RETURNING id         AS ""Id"",
                            payslip_id AS ""PayslipId"",
                            type       AS ""Type"",
                            amount     AS ""Amount"",
                            note       AS ""Note"",
                            created_by AS ""CreatedBy"",
                            created_at AS ""CreatedAt""",
                new
                {
                    PayslipId = payslipId,
                    Type = type,
                    Amount = amount,
                    Note = note,
                    CreatedBy = userId
                });
        }

        public async Task<List<SalaryStructure>> GetSalaryStructuresAsync(int? employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var sql = SalaryStructureSelect;
            if (employeeId.HasValue)
            {
                sql += @" WHERE s.employee_id = @EmployeeId";
            }
            sql += @" ORDER BY s.effective_from DESC, s.id DESC";

            var rows = await connection.QueryAsync<SalaryStructure>(
                sql,
                new { EmployeeId = employeeId });
            return rows.ToList();
        }

        public async Task<SalaryStructure?> GetSalaryStructureAsync(long id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<SalaryStructure>(
                $@"{SalaryStructureSelect} WHERE s.id = @Id",
                new { Id = id });
        }

        public async Task<SalaryStructure> CreateSalaryStructureAsync(SalaryStructure structure)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var id = await connection.ExecuteScalarAsync<long>(
                @"INSERT INTO salary_structures
                      (employee_id, basic, hra, allowances, effective_from, created_by)
                  VALUES
                      (@EmployeeId, @Basic, @Hra, @Allowances, @EffectiveFrom::date, @CreatedBy)
                  RETURNING id",
                new
                {
                    structure.EmployeeId,
                    structure.Basic,
                    structure.Hra,
                    structure.Allowances,
                    structure.EffectiveFrom,
                    structure.CreatedBy
                });

            return (await GetSalaryStructureAsync(id))!;
        }

        public async Task<bool> EmployeeExistsAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<bool>(
                @"SELECT COUNT(*) > 0 FROM ""Employees"" WHERE ""Id"" = @Id",
                new { Id = employeeId });
        }

        public async Task<DeductionRule> CreateDeductionRuleAsync(DeductionRule rule)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleAsync<DeductionRule>(
                @"INSERT INTO deduction_rules (name, type, value, is_active)
                  VALUES (@Name, @Type, @Value, @IsActive)
                  RETURNING id         AS ""Id"",
                            name       AS ""Name"",
                            type       AS ""Type"",
                            value      AS ""Value"",
                            is_active  AS ""IsActive"",
                            created_at AS ""CreatedAt""",
                rule);
        }

        public async Task<DeductionRule?> UpdateDeductionRuleAsync(long id, DeductionRule rule)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<DeductionRule>(
                @"UPDATE deduction_rules
                     SET name = @Name, type = @Type, value = @Value, is_active = @IsActive
                   WHERE id = @Id
                  RETURNING id         AS ""Id"",
                            name       AS ""Name"",
                            type       AS ""Type"",
                            value      AS ""Value"",
                            is_active  AS ""IsActive"",
                            created_at AS ""CreatedAt""",
                new
                {
                    Id = id,
                    rule.Name,
                    rule.Type,
                    rule.Value,
                    rule.IsActive
                });
        }

        public async Task<bool> DeductionRuleNameExistsAsync(string name, long? excludeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<bool>(
                @"SELECT COUNT(*) > 0
                    FROM deduction_rules
                   WHERE LOWER(name) = LOWER(@Name)
                     AND (@ExcludeId::bigint IS NULL OR id <> @ExcludeId)",
                new { Name = name, ExcludeId = excludeId });
        }

        public async Task<PayrollHoliday> CreateHolidayAsync(DateTime date, string name, int userId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleAsync<PayrollHoliday>(
                @"INSERT INTO payroll_holidays (holiday_date, name, created_by)
                  VALUES (@Date::date, @Name, @CreatedBy)
                  RETURNING id           AS ""Id"",
                            holiday_date::timestamp AS ""HolidayDate"",
                            name         AS ""Name"",
                            created_by   AS ""CreatedBy"",
                            created_at   AS ""CreatedAt""",
                new { Date = date, Name = name, CreatedBy = userId });
        }

        public async Task<bool> DeleteHolidayAsync(long id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var deleted = await connection.ExecuteAsync(
                "DELETE FROM payroll_holidays WHERE id = @Id",
                new { Id = id });
            return deleted > 0;
        }

        public async Task<bool> HolidayExistsAsync(DateTime date)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<bool>(
                "SELECT COUNT(*) > 0 FROM payroll_holidays WHERE holiday_date = @Date::date",
                new { Date = date });
        }

        public async Task ReplaceWeekOffDaysAsync(int[] days)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                await connection.ExecuteAsync(
                    "DELETE FROM payroll_week_off_days",
                    transaction: transaction);

                if (days.Length > 0)
                {
                    await connection.ExecuteAsync(
                        @"INSERT INTO payroll_week_off_days (day_of_week)
                          SELECT unnest(@Days::smallint[])",
                        new { Days = days.Select(d => (short)d).ToArray() },
                        transaction);
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task AddAuditAsync(
            int? userId,
            string action,
            string entity,
            long? entityId,
            string details)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
                  VALUES (@UserId, @Action, @Entity, @EntityId, @Details::jsonb)",
                new
                {
                    UserId = userId,
                    Action = action,
                    Entity = entity,
                    EntityId = entityId,
                    Details = string.IsNullOrWhiteSpace(details) ? "{}" : details
                });
        }

        private static string EscapeLike(string value) =>
            value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
    }
}
