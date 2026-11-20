using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;
using System.Text.Json;

namespace ASPCoreWebAPI.Repositories
{
    public interface IAttendanceRegisterRepository
    {
        Task<AttendanceRegisterSettingsDto> GetSettingsAsync();
        Task UpdateSettingsAsync(bool? sandwichRuleEnabled, bool? halfDayLopEnabled, int userId);
        Task<List<AttendanceRegisterOptionDto>> GetDepartmentsAsync();
        Task<List<AttendanceRegisterOptionDto>> GetLocationsAsync();
        Task<List<AttendanceRegisterOptionDto>> GetShiftsAsync();
        Task<HashSet<int>> GetManagedEmployeeIdsAsync(int employeeId);
        Task<List<int>> GetWeekOffDaysAsync();
        Task<List<AttendanceRegisterEmployeeRow>> GetEmployeesAsync(
            DateTime monthStart,
            DateTime monthEnd,
            AttendanceRegisterQuery query,
            int[]? visibleEmployeeIds);
        Task<List<AttendanceRegisterShiftRow>> GetShiftsAsync(
            DateTime monthStart,
            DateTime monthEnd,
            int[] employeeIds);
        Task<List<AttendanceRegisterAttendanceRow>> GetAttendanceAsync(
            DateTime monthStart,
            DateTime monthEnd,
            int[] employeeIds);
        Task<List<AttendanceRegisterLeaveRow>> GetLeavesAsync(
            DateTime monthStart,
            DateTime monthEnd,
            int[] employeeIds);
        Task<List<AttendanceRegisterHolidayRow>> GetHolidaysAsync(
            DateTime monthStart,
            DateTime monthEnd);
        Task<AttendanceRegisterLockRow?> GetLatestLockAsync(int year, int month);
        Task<AttendanceRegisterLockRow?> GetLockByPayrollRunAsync(long payrollRunId);
        Task<List<AttendanceRegisterLockRow>> GetLockHistoryAsync(int year, int month);
        Task<long> CreateLockAsync(
            int year,
            int month,
            long? payrollRunId,
            int? userId,
            string? reason,
            string settingsJson,
            IReadOnlyList<AttendanceRegisterSnapshotRow> snapshots);
        Task<List<AttendanceRegisterSnapshotRow>> GetSnapshotsAsync(long lockId);
        Task<Dictionary<int, PayrollRegisterTotalsDto>> GetSnapshotTotalsAsync(int year, int month);
        Task<Dictionary<int, decimal>> GetPayslipLopAsync(long payrollRunId);
        Task MarkAttendanceAsync(
            int employeeId,
            DateTime businessDate,
            int? shiftAssignmentId,
            string code,
            DateTime? checkInTime,
            DateTime? checkOutTime,
            int userId,
            string reason);
    }

    public class AttendanceRegisterRepository : IAttendanceRegisterRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public AttendanceRegisterRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<AttendanceRegisterSettingsDto> GetSettingsAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var row = await connection.QuerySingleOrDefaultAsync<AttendanceRegisterSettingsDto>(
                @"SELECT COALESCE(sandwich_rule_enabled, FALSE) AS ""SandwichRuleEnabled"",
                         COALESCE(half_day_lop_enabled, TRUE) AS ""HalfDayLopEnabled"",
                         COALESCE(timezone_id, 'Asia/Kolkata') AS ""TimezoneId"",
                         COALESCE(standard_hours, 10) AS ""StandardHours""
                    FROM attendance_config
                   ORDER BY effective_from DESC, id DESC
                   LIMIT 1");
            return row ?? new AttendanceRegisterSettingsDto();
        }

        public async Task UpdateSettingsAsync(bool? sandwichRuleEnabled, bool? halfDayLopEnabled, int userId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"UPDATE attendance_config
                     SET sandwich_rule_enabled = COALESCE(@SandwichRuleEnabled, sandwich_rule_enabled),
                         half_day_lop_enabled = COALESCE(@HalfDayLopEnabled, half_day_lop_enabled),
                         updated_by = @UserId,
                         updated_at = NOW()
                   WHERE id = (SELECT id FROM attendance_config ORDER BY effective_from DESC, id DESC LIMIT 1)",
                new { SandwichRuleEnabled = sandwichRuleEnabled, HalfDayLopEnabled = halfDayLopEnabled, UserId = userId });
        }

        public async Task<List<AttendanceRegisterOptionDto>> GetDepartmentsAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterOptionDto>(
                @"SELECT ""Id"" AS ""Id"", ""Name"" AS ""Name""
                    FROM ""Departments""
                   ORDER BY ""Name""");
            return rows.ToList();
        }

        public async Task<List<AttendanceRegisterOptionDto>> GetLocationsAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterOptionDto>(
                @"SELECT ""Id"" AS ""Id"", ""Name"" AS ""Name""
                    FROM ""WorkLocations""
                   WHERE COALESCE(""IsActive"", TRUE)
                   ORDER BY ""Name""");
            return rows.ToList();
        }

        public async Task<List<AttendanceRegisterOptionDto>> GetShiftsAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterOptionDto>(
                @"SELECT shift_id AS ""Id"", shift_name AS ""Name""
                    FROM shift
                   WHERE COALESCE(is_active, TRUE)
                   ORDER BY shift_name");
            return rows.ToList();
        }

        public async Task<HashSet<int>> GetManagedEmployeeIdsAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var ids = await connection.QueryAsync<int>(
                @"SELECT ""Id""
                    FROM ""Employees""
                   WHERE ""ManagerId"" = @EmployeeId",
                new { EmployeeId = employeeId });
            return ids.ToHashSet();
        }

        public async Task<List<int>> GetWeekOffDaysAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<int>(
                "SELECT day_of_week FROM payroll_week_off_days ORDER BY day_of_week");
            return rows.ToList();
        }

        public async Task<List<AttendanceRegisterEmployeeRow>> GetEmployeesAsync(
            DateTime monthStart,
            DateTime monthEnd,
            AttendanceRegisterQuery query,
            int[]? visibleEmployeeIds)
        {
            using var connection = await _dataSource.OpenConnectionAsync();

            var sql = @"
                SELECT e.""Id"" AS ""EmployeeId"",
                       e.""EmployeeCode"" AS ""EmployeeCode"",
                       COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                                u.""Email"", e.""EmployeeCode"", 'Unknown') AS ""EmployeeName"",
                       u.""Email"" AS ""Email"",
                       e.""DepartmentId"" AS ""DepartmentId"",
                       dep.""Name"" AS ""DepartmentName"",
                       e.""WorkLocationId"" AS ""LocationId"",
                       wl.""Name"" AS ""LocationName"",
                       e.""ManagerId"" AS ""ManagerId"",
                       mu.""FirstName"" || ' ' || mu.""LastName"" AS ""ManagerName"",
                       e.""JoiningDate""::timestamp AS ""JoiningDate"",
                       CASE WHEN e.""ExitDate"" IS NULL
                                 AND LOWER(COALESCE(e.""Status"", 'Active')) <> 'active'
                                 AND la.last_attendance_date IS NOT NULL
                            THEN la.last_attendance_date::timestamp
                            ELSE e.""ExitDate""::timestamp END AS ""ExitDate"",
                       CASE WHEN e.""ExitDate"" IS NOT NULL THEN 'MANUAL'
                            WHEN e.""ExitDate"" IS NULL
                                 AND LOWER(COALESCE(e.""Status"", 'Active')) <> 'active'
                                 AND la.last_attendance_date IS NOT NULL THEN 'ESTIMATED'
                            ELSE NULL END AS ""ExitDateSource"",
                       la.last_attendance_date::timestamp AS ""LastAttendanceDate"",
                       e.""Status"" AS ""Status""
                  FROM ""Employees"" e
                  LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""
                  LEFT JOIN ""Departments"" dep ON dep.""Id"" = e.""DepartmentId""
                  LEFT JOIN ""WorkLocations"" wl ON wl.""Id"" = e.""WorkLocationId""
                  LEFT JOIN ""Employees"" mgr ON mgr.""Id"" = e.""ManagerId""
                  LEFT JOIN ""Users"" mu ON mu.""Id"" = mgr.""UserId""
                  LEFT JOIN LATERAL (
                      SELECT MAX(a.attendance_date) AS last_attendance_date
                        FROM attendance a
                       WHERE a.employee_id = e.""Id""
                  ) la ON TRUE
                 WHERE COALESCE(e.""JoiningDate""::date, DATE '1900-01-01') <= @MonthEnd::date
                   AND (LOWER(COALESCE(e.""Status"", 'Active')) = 'active'
                        OR COALESCE(e.""ExitDate"", la.last_attendance_date) >= @MonthStart::date)
                   AND (e.""ExitDate"" IS NULL OR e.""ExitDate""::date >= @MonthStart::date
                        OR EXISTS (SELECT 1 FROM attendance ax
                                    WHERE ax.employee_id = e.""Id""
                                      AND ax.attendance_date BETWEEN @MonthStart::date AND @MonthEnd::date))";

            var parameters = new DynamicParameters();
            parameters.Add("MonthStart", monthStart.Date);
            parameters.Add("MonthEnd", monthEnd.Date);

            if (visibleEmployeeIds is not null)
            {
                if (visibleEmployeeIds.Length == 0)
                    return new List<AttendanceRegisterEmployeeRow>();

                sql += @" AND e.""Id"" = ANY(@VisibleEmployeeIds)";
                parameters.Add("VisibleEmployeeIds", visibleEmployeeIds);
            }

            if (query.DepartmentId.HasValue)
            {
                sql += @" AND e.""DepartmentId"" = @DepartmentId";
                parameters.Add("DepartmentId", query.DepartmentId.Value);
            }

            if (query.LocationId.HasValue)
            {
                sql += @" AND e.""WorkLocationId"" = @LocationId";
                parameters.Add("LocationId", query.LocationId.Value);
            }

            if (query.ShiftId.HasValue)
            {
                sql += @" AND EXISTS (
                    SELECT 1 FROM shift_assignment sa
                     WHERE sa.emp_id = e.""Id""
                       AND sa.shift_id = @ShiftId
                       AND sa.status <> 'Cancelled'
                       AND sa.shift_date BETWEEN @MonthStart::date AND @MonthEnd::date)";
                parameters.Add("ShiftId", query.ShiftId.Value);
            }

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                sql += @" AND (e.""EmployeeCode"" ILIKE @Search
                           OR u.""FirstName"" ILIKE @Search
                           OR u.""LastName"" ILIKE @Search
                           OR u.""Email"" ILIKE @Search)";
                parameters.Add("Search", $"%{EscapeLike(query.Search.Trim())}%");
            }

            sql += @" ORDER BY COALESCE(dep.""Name"", ''), ""EmployeeName""";

            var rows = await connection.QueryAsync<AttendanceRegisterEmployeeRow>(sql, parameters);
            return rows.ToList();
        }

        public async Task<List<AttendanceRegisterShiftRow>> GetShiftsAsync(
            DateTime monthStart,
            DateTime monthEnd,
            int[] employeeIds)
        {
            if (employeeIds.Length == 0)
                return new List<AttendanceRegisterShiftRow>();

            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterShiftRow>(
                @"SELECT sa.id AS ""AssignmentId"",
                         sa.emp_id AS ""EmployeeId"",
                         sa.shift_id AS ""ShiftId"",
                         s.shift_name AS ""ShiftName"",
                         sa.shift_date::timestamp AS ""ShiftDate"",
                         sa.shift_start_dt AS ""ShiftStart"",
                         sa.shift_end_dt AS ""ShiftEnd"",
                         COALESCE(s.crosses_midnight, FALSE) AS ""CrossesMidnight"",
                         sa.status AS ""Status""
                    FROM shift_assignment sa
                    JOIN shift s ON s.shift_id = sa.shift_id
                   WHERE sa.emp_id = ANY(@EmployeeIds)
                     AND sa.status <> 'Cancelled'
                     AND sa.shift_date BETWEEN @MonthStart::date AND @MonthEnd::date
                   ORDER BY sa.emp_id, sa.shift_date, sa.shift_start_dt, sa.id",
                new { EmployeeIds = employeeIds, MonthStart = monthStart.Date, MonthEnd = monthEnd.Date });
            return rows.ToList();
        }

        public async Task<List<AttendanceRegisterAttendanceRow>> GetAttendanceAsync(
            DateTime monthStart,
            DateTime monthEnd,
            int[] employeeIds)
        {
            if (employeeIds.Length == 0)
                return new List<AttendanceRegisterAttendanceRow>();

            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterAttendanceRow>(
                @"SELECT a.id AS ""Id"",
                         a.employee_id AS ""EmployeeId"",
                         a.shift_assignment_id AS ""ShiftAssignmentId"",
                         COALESCE(sa.shift_date, a.attendance_date)::timestamp AS ""AttendanceDate"",
                         a.check_in_time AS ""CheckInTime"",
                         a.check_out_time AS ""CheckOutTime"",
                         a.working_hours AS ""WorkingHours"",
                         a.status::text AS ""Status"",
                         a.is_late AS ""IsLate"",
                         a.missing_punch_detected_at AS ""MissingPunchDetectedAt"",
                         a.source AS ""Source"",
                         a.check_in_location_name AS ""CheckInLocationName"",
                         a.check_out_location_name AS ""CheckOutLocationName"",
                         a.register_code AS ""RegisterCode"",
                         a.updated_at AS ""UpdatedAt""
                    FROM attendance a
                    LEFT JOIN shift_assignment sa ON sa.id = a.shift_assignment_id
                   WHERE a.employee_id = ANY(@EmployeeIds)
                     AND COALESCE(sa.shift_date, a.attendance_date::date)
                         BETWEEN @MonthStart::date AND @MonthEnd::date
                   ORDER BY a.employee_id, COALESCE(sa.shift_date, a.attendance_date::date), a.check_in_time, a.id",
                new { EmployeeIds = employeeIds, MonthStart = monthStart.Date, MonthEnd = monthEnd.Date });
            return rows.ToList();
        }

        public async Task<List<AttendanceRegisterLeaveRow>> GetLeavesAsync(
            DateTime monthStart,
            DateTime monthEnd,
            int[] employeeIds)
        {
            if (employeeIds.Length == 0)
                return new List<AttendanceRegisterLeaveRow>();

            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterLeaveRow>(
                @"SELECT l.""Id"" AS ""Id"",
                         l.""EmployeeId"" AS ""EmployeeId"",
                         l.""LeaveType"" AS ""LeaveType"",
                         COALESCE(lt.is_paid, TRUE) AS ""IsPaid"",
                         COALESCE(l.""HalfDay"", FALSE) AS ""HalfDay"",
                         l.""Days"" AS ""Days"",
                         l.""StartDate""::timestamp AS ""StartDate"",
                         l.""EndDate""::timestamp AS ""EndDate"",
                         l.""Status"" AS ""Status""
                    FROM ""Leaves"" l
                    LEFT JOIN leave_types lt ON LOWER(lt.name) = LOWER(l.""LeaveType"")
                   WHERE l.""EmployeeId"" = ANY(@EmployeeIds)
                     AND l.""StartDate""::date <= @MonthEnd::date
                     AND l.""EndDate""::date >= @MonthStart::date
                     AND LOWER(l.""Status"") IN ('approved', 'pending')
                   ORDER BY l.""EmployeeId"", l.""StartDate"", l.""Id""",
                new { EmployeeIds = employeeIds, MonthStart = monthStart.Date, MonthEnd = monthEnd.Date });
            return rows.ToList();
        }

        public async Task<List<AttendanceRegisterHolidayRow>> GetHolidaysAsync(
            DateTime monthStart,
            DateTime monthEnd)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterHolidayRow>(
                @"SELECT id AS ""Id"", holiday_date::timestamp AS ""HolidayDate"", name AS ""Name""
                    FROM payroll_holidays
                   WHERE holiday_date BETWEEN @MonthStart::date AND @MonthEnd::date
                   ORDER BY holiday_date",
                new { MonthStart = monthStart.Date, MonthEnd = monthEnd.Date });
            return rows.ToList();
        }

        public async Task<AttendanceRegisterLockRow?> GetLatestLockAsync(int year, int month)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<AttendanceRegisterLockRow>(
                @"SELECT l.id AS ""Id"",
                         l.year AS ""Year"",
                         l.month AS ""Month"",
                         l.version AS ""Version"",
                         l.payroll_run_id AS ""PayrollRunId"",
                         l.locked_at AS ""LockedAt"",
                         l.locked_by AS ""LockedByUserId"",
                         COALESCE(u.""FirstName"" || ' ' || u.""LastName"", u.""Email"") AS ""LockedByName"",
                         l.reason AS ""Reason"",
                         l.settings::text AS ""SettingsJson""
                    FROM attendance_register_locks l
                    LEFT JOIN ""Users"" u ON u.""Id"" = l.locked_by
                   WHERE l.year = @Year AND l.month = @Month
                   ORDER BY l.version DESC
                   LIMIT 1",
                new { Year = year, Month = month });
        }

        public async Task<AttendanceRegisterLockRow?> GetLockByPayrollRunAsync(long payrollRunId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<AttendanceRegisterLockRow>(
                @"SELECT l.id AS ""Id"",
                         l.year AS ""Year"",
                         l.month AS ""Month"",
                         l.version AS ""Version"",
                         l.payroll_run_id AS ""PayrollRunId"",
                         l.locked_at AS ""LockedAt"",
                         l.locked_by AS ""LockedByUserId"",
                         COALESCE(u.""FirstName"" || ' ' || u.""LastName"", u.""Email"") AS ""LockedByName"",
                         l.reason AS ""Reason"",
                         l.settings::text AS ""SettingsJson""
                    FROM attendance_register_locks l
                    LEFT JOIN ""Users"" u ON u.""Id"" = l.locked_by
                   WHERE l.payroll_run_id = @RunId
                   LIMIT 1",
                new { RunId = payrollRunId });
        }

        public async Task<List<AttendanceRegisterLockRow>> GetLockHistoryAsync(int year, int month)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterLockRow>(
                @"SELECT l.id AS ""Id"",
                         l.year AS ""Year"",
                         l.month AS ""Month"",
                         l.version AS ""Version"",
                         l.payroll_run_id AS ""PayrollRunId"",
                         l.locked_at AS ""LockedAt"",
                         l.locked_by AS ""LockedByUserId"",
                         COALESCE(u.""FirstName"" || ' ' || u.""LastName"", u.""Email"") AS ""LockedByName"",
                         l.reason AS ""Reason"",
                         l.settings::text AS ""SettingsJson""
                    FROM attendance_register_locks l
                    LEFT JOIN ""Users"" u ON u.""Id"" = l.locked_by
                   WHERE l.year = @Year AND l.month = @Month
                   ORDER BY l.version DESC",
                new { Year = year, Month = month });
            return rows.ToList();
        }

        public async Task<long> CreateLockAsync(
            int year,
            int month,
            long? payrollRunId,
            int? userId,
            string? reason,
            string settingsJson,
            IReadOnlyList<AttendanceRegisterSnapshotRow> snapshots)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                await connection.ExecuteAsync(
                    "SELECT pg_advisory_xact_lock(@Key)",
                    new { Key = year * 100 + month },
                    transaction);

                var version = await connection.ExecuteScalarAsync<int>(
                    @"SELECT COALESCE(MAX(version), 0) + 1
                        FROM attendance_register_locks
                       WHERE year = @Year AND month = @Month",
                    new { Year = year, Month = month },
                    transaction);

                var lockId = await connection.ExecuteScalarAsync<long>(
                    @"INSERT INTO attendance_register_locks
                          (year, month, version, payroll_run_id, locked_by, reason, settings)
                      VALUES (@Year, @Month, @Version, @PayrollRunId, @UserId, @Reason, @Settings::jsonb)
                      RETURNING id",
                    new
                    {
                        Year = year,
                        Month = month,
                        Version = version,
                        PayrollRunId = payrollRunId,
                        UserId = userId,
                        Reason = reason,
                        Settings = string.IsNullOrWhiteSpace(settingsJson) ? "{}" : settingsJson
                    },
                    transaction);

                foreach (var snapshot in snapshots)
                {
                    await connection.ExecuteAsync(
                        @"INSERT INTO attendance_register_snapshot
                              (lock_id, employee_id, employee_code, employee_name, department_id,
                               department_name, location_id, location_name, joining_date, exit_date,
                               shift_ids, days, totals, flags)
                          VALUES (@LockId, @EmployeeId, @EmployeeCode, @EmployeeName, @DepartmentId,
                                  @DepartmentName, @LocationId, @LocationName, @JoiningDate, @ExitDate,
                                  @ShiftIds, @DaysJson::jsonb, @TotalsJson::jsonb, @FlagsJson::jsonb)",
                        new
                        {
                            LockId = lockId,
                            snapshot.EmployeeId,
                            snapshot.EmployeeCode,
                            snapshot.EmployeeName,
                            snapshot.DepartmentId,
                            snapshot.DepartmentName,
                            snapshot.LocationId,
                            snapshot.LocationName,
                            JoiningDate = snapshot.JoiningDate?.Date,
                            ExitDate = snapshot.ExitDate?.Date,
                            snapshot.ShiftIds,
                            snapshot.DaysJson,
                            snapshot.TotalsJson,
                            snapshot.FlagsJson
                        },
                        transaction);
                }

                await connection.ExecuteAsync(
                    @"INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
                      VALUES (@UserId, 'LOCK', 'attendance_register', @LockId, @Details::jsonb)",
                    new
                    {
                        UserId = userId,
                        LockId = lockId,
                        Details = JsonSerializer.Serialize(new
                        {
                            year,
                            month,
                            version,
                            payrollRunId,
                            employeeCount = snapshots.Count
                        })
                    },
                    transaction);

                await transaction.CommitAsync();
                return lockId;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<List<AttendanceRegisterSnapshotRow>> GetSnapshotsAsync(long lockId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AttendanceRegisterSnapshotRow>(
                @"SELECT employee_id AS ""EmployeeId"",
                         employee_code AS ""EmployeeCode"",
                         employee_name AS ""EmployeeName"",
                         department_id AS ""DepartmentId"",
                         department_name AS ""DepartmentName"",
                         location_id AS ""LocationId"",
                         location_name AS ""LocationName"",
                         joining_date::timestamp AS ""JoiningDate"",
                         exit_date::timestamp AS ""ExitDate"",
                         shift_ids AS ""ShiftIds"",
                         days::text AS ""DaysJson"",
                         totals::text AS ""TotalsJson"",
                         flags::text AS ""FlagsJson""
                    FROM attendance_register_snapshot
                   WHERE lock_id = @LockId
                   ORDER BY employee_name",
                new { LockId = lockId });
            return rows.ToList();
        }

        public async Task<Dictionary<int, PayrollRegisterTotalsDto>> GetSnapshotTotalsAsync(int year, int month)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<PayrollRegisterTotalsDto>(
                @"SELECT s.employee_id AS ""EmployeeId"",
                         COALESCE((s.totals->>'LopDays')::numeric, 0) AS ""LopDays"",
                         COALESCE((s.totals->>'PayableDays')::numeric, 0) AS ""PayableDays"",
                         COALESCE((s.totals->>'DaysInMonth')::int, 0) AS ""DaysInMonth"",
                         COALESCE((s.totals->>'Dash')::numeric, 0) AS ""DashDays"",
                         COALESCE((s.totals->>'Pending')::numeric, 0) AS ""PendingDays"",
                         l.id AS ""LockId"",
                         l.version AS ""LockVersion""
                    FROM attendance_register_snapshot s
                    JOIN attendance_register_locks l ON l.id = s.lock_id
                   WHERE l.year = @Year
                     AND l.month = @Month
                     AND l.version = (
                         SELECT MAX(version)
                           FROM attendance_register_locks
                          WHERE year = @Year AND month = @Month)",
                new { Year = year, Month = month });
            return rows.ToDictionary(r => r.EmployeeId, r => r);
        }

        public async Task<Dictionary<int, decimal>> GetPayslipLopAsync(long payrollRunId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<(int EmployeeId, decimal LopDays)>(
                @"SELECT employee_id, lop_days
                    FROM payslips
                   WHERE run_id = @RunId
                     AND version = (SELECT MAX(version) FROM payslips p2
                                     WHERE p2.run_id = payslips.run_id
                                       AND p2.employee_id = payslips.employee_id)",
                new { RunId = payrollRunId });
            return rows.ToDictionary(r => r.EmployeeId, r => r.LopDays);
        }

        public async Task MarkAttendanceAsync(
            int employeeId,
            DateTime businessDate,
            int? shiftAssignmentId,
            string code,
            DateTime? checkInTime,
            DateTime? checkOutTime,
            int userId,
            string reason)
        {
            var normalized = string.IsNullOrWhiteSpace(code) ? "P" : code.Trim().ToUpperInvariant();
            var status = normalized switch
            {
                "P" => "Present",
                "LT" => "Late",
                "HD" => "Half-day",
                "A" => "Absent",
                "L" => "Leave",
                "UL" => "Leave",
                "H" => "Holiday",
                "WO" => "Holiday",
                _ => throw new InvalidOperationException("Unsupported attendance code.")
            };

            DateTime? checkIn = normalized is "P" or "LT" or "HD" ? checkInTime : null;
            DateTime? checkOut = normalized is "P" or "LT" or "HD" ? checkOutTime : null;
            decimal? workingHours = checkIn.HasValue && checkOut.HasValue && checkOut > checkIn
                ? Math.Round((decimal)(checkOut.Value - checkIn.Value).TotalHours, 2)
                : null;

            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var assignmentId = shiftAssignmentId;
                if (assignmentId is null)
                {
                    assignmentId = await connection.ExecuteScalarAsync<int?>(
                        @"SELECT id
                            FROM shift_assignment
                           WHERE emp_id = @EmployeeId
                             AND shift_date = @BusinessDate::date
                             AND status <> 'Cancelled'
                           ORDER BY shift_start_dt, id
                           LIMIT 1",
                        new { EmployeeId = employeeId, BusinessDate = businessDate.Date },
                        transaction);
                }

                var existing = await connection.QuerySingleOrDefaultAsync<AttendanceRegisterAttendanceRow>(
                    @"SELECT a.id AS ""Id"",
                             a.employee_id AS ""EmployeeId"",
                             a.shift_assignment_id AS ""ShiftAssignmentId"",
                             a.attendance_date AS ""AttendanceDate"",
                             a.check_in_time AS ""CheckInTime"",
                             a.check_out_time AS ""CheckOutTime"",
                             a.working_hours AS ""WorkingHours"",
                             a.status::text AS ""Status"",
                             a.is_late AS ""IsLate"",
                             a.source AS ""Source"",
                             a.register_code AS ""RegisterCode""
                        FROM attendance a
                       WHERE (@AssignmentId::int IS NOT NULL AND a.shift_assignment_id = @AssignmentId)
                          OR (@AssignmentId::int IS NULL
                              AND a.employee_id = @EmployeeId
                              AND a.shift_assignment_id IS NULL
                              AND a.attendance_date = @BusinessDate::date)
                       ORDER BY a.id
                       LIMIT 1",
                    new
                    {
                        AssignmentId = assignmentId,
                        EmployeeId = employeeId,
                        BusinessDate = businessDate.Date
                    },
                    transaction);

                var before = existing is null ? "{}" : JsonSerializer.Serialize(new
                {
                    existing.Status,
                    existing.CheckInTime,
                    existing.CheckOutTime,
                    existing.WorkingHours,
                    existing.RegisterCode
                });

                if (existing is null)
                {
                    await connection.ExecuteAsync(
                        @"INSERT INTO attendance
                              (employee_id, attendance_date, shift_assignment_id, check_in_time,
                               check_out_time, working_hours, status, is_late, source, register_code,
                               updated_at)
                          VALUES (@EmployeeId, @BusinessDate::date, @AssignmentId, @CheckInTime,
                                  @CheckOutTime, @WorkingHours, @Status::attendance_status, @IsLate,
                                  'ADMIN_OVERRIDE', @Code, NOW())",
                        new
                        {
                            EmployeeId = employeeId,
                            BusinessDate = businessDate.Date,
                            AssignmentId = assignmentId,
                            CheckInTime = checkIn,
                            CheckOutTime = checkOut,
                            WorkingHours = workingHours,
                            Status = status,
                            IsLate = normalized == "LT",
                            Code = normalized
                        },
                        transaction);
                }
                else
                {
                    await connection.ExecuteAsync(
                        @"UPDATE attendance
                             SET check_in_time = @CheckInTime,
                                 check_out_time = @CheckOutTime,
                                 working_hours = @WorkingHours,
                                 status = @Status::attendance_status,
                                 is_late = @IsLate,
                                 source = 'ADMIN_OVERRIDE',
                                 register_code = @Code,
                                 missing_punch_detected_at = NULL,
                                 updated_at = NOW()
                           WHERE id = @Id",
                        new
                        {
                            Id = existing.Id,
                            CheckInTime = checkIn,
                            CheckOutTime = checkOut,
                            WorkingHours = workingHours,
                            Status = status,
                            IsLate = normalized == "LT",
                            Code = normalized
                        },
                        transaction);
                }

                var after = JsonSerializer.Serialize(new
                {
                    Code = normalized,
                    Status = status,
                    CheckInTime = checkIn,
                    CheckOutTime = checkOut,
                    WorkingHours = workingHours
                });

                await connection.ExecuteAsync(
                    @"INSERT INTO audit_logs
                          (user_id, action, entity, entity_id, details, reason, source, ""before"", ""after"")
                      VALUES (@UserId, 'UPDATE', 'attendance', @EmployeeId, @Details::jsonb, @Reason,
                              'REGISTER', @Before::jsonb, @After::jsonb)",
                    new
                    {
                        UserId = userId,
                        EmployeeId = employeeId,
                        Details = JsonSerializer.Serialize(new { date = businessDate.ToString("yyyy-MM-dd"), code = normalized }),
                        Reason = reason,
                        Before = before,
                        After = after
                    },
                    transaction);

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private static string EscapeLike(string value) =>
            value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
    }
}
