using System.Text.Json;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;

namespace ASPCoreWebAPI.Services
{
    public sealed class PayrollValidationException : Exception
    {
        public PayrollValidationException(string message) : base(message) { }
    }

    public sealed class PayrollConflictException : Exception
    {
        public PayrollConflictException(string message) : base(message) { }
    }

    public sealed class PayrollNotFoundException : Exception
    {
        public PayrollNotFoundException(string message) : base(message) { }
    }

    public interface IPayrollService
    {
        Task<PayrollRunDto> CreateRunAsync(CreatePayrollRunRequest request, int userId);
        Task<List<PayrollRunDto>> GetRunsAsync();
        Task<PayrollRunDto?> GetRunAsync(long id);
        Task<PayslipListResponse> GetRunPayslipsAsync(long runId, PayrollRunPayslipsQuery query);
        Task<PayslipDto?> GetPayslipAsync(long id);
        Task<List<PayslipSummaryDto>> GetMyPayslipsAsync(int employeeId, int? year);
        Task<PayslipDto?> GetMyPayslipAsync(int employeeId, long payslipId);
        Task<PayslipDto?> GetMyLatestPayslipAsync(int employeeId);
        Task<PayslipDownloadDto?> GetMyPayslipDownloadAsync(
            int employeeId,
            long payslipId,
            CancellationToken cancellationToken = default);
        Task<List<PayslipSummaryDto>?> GetPayslipVersionsAsync(long id);
        Task<PayslipDto> ReissuePayslipAsync(
            long id,
            ReissuePayslipRequest request,
            int userId);
        Task<List<PayrollJobDto>?> GetRunJobsAsync(long runId);
        Task<AddAdjustmentResult> AddAdjustmentAsync(
            long payslipId,
            AddPayslipAdjustmentRequest request,
            int userId);
        Task<PayrollRunDto?> QueueRecalculationAsync(long runId, int userId);
        Task<PayrollRunDto> ApproveRunAsync(long runId, int userId);
        Task<PayrollRunDto> PublishRunAsync(long runId, int userId);
        Task ProcessRunAsync(long runId, CancellationToken cancellationToken);

        Task<List<SalaryStructureDto>> GetSalaryStructuresAsync(int? employeeId);
        Task<SalaryStructureDto> CreateSalaryStructureAsync(
            CreateSalaryStructureRequest request,
            int userId);
        Task<List<DeductionRuleDto>> GetDeductionRulesAsync();
        Task<DeductionRuleDto> CreateDeductionRuleAsync(CreateDeductionRuleRequest request);
        Task<DeductionRuleDto?> UpdateDeductionRuleAsync(
            long id,
            UpdateDeductionRuleRequest request);
        Task<List<PayrollHolidayDto>> GetHolidaysAsync(int? year);
        Task<PayrollHolidayDto> CreateHolidayAsync(CreateHolidayRequest request, int userId);
        Task<bool> DeleteHolidayAsync(long id);
        Task<List<int>> GetWeekOffDaysAsync();
        Task<List<int>> SetWeekOffDaysAsync(SetWeekOffRequest request, int userId);
    }

    public class PayrollService : IPayrollService
    {
        private readonly IPayrollRepository _repository;
        private readonly IPayslipPdfService _payslipPdfService;
        private readonly IAttendanceRegisterService _attendanceRegisterService;

        public PayrollService(
            IPayrollRepository repository,
            IPayslipPdfService payslipPdfService,
            IAttendanceRegisterService attendanceRegisterService)
        {
            _repository = repository;
            _payslipPdfService = payslipPdfService;
            _attendanceRegisterService = attendanceRegisterService;
        }

        public async Task<PayrollRunDto> CreateRunAsync(CreatePayrollRunRequest request, int userId)
        {
            if (request.Month is < 1 or > 12)
            {
                throw new PayrollValidationException("Month must be between 1 and 12.");
            }

            if (request.Year is < 2000 or > 2100)
            {
                throw new PayrollValidationException("Year must be between 2000 and 2100.");
            }

            var periodStart = new DateTime(request.Year, request.Month, 1);
            var today = DateTime.Today;
            var currentPeriod = new DateTime(today.Year, today.Month, 1);

            if (periodStart > currentPeriod)
            {
                throw new PayrollValidationException("Future payroll runs are not allowed.");
            }

            if (await _repository.RunExistsAsync(request.Month, request.Year))
            {
                throw new PayrollConflictException("A payroll run already exists for this month.");
            }

            var runId = await _repository.CreateRunWithJobAsync(
                request.Month,
                request.Year,
                userId,
                PayrollJobTypes.CalculateRun);

            await _repository.AddAuditAsync(
                userId,
                "PAYROLL_RUN_CREATED",
                "payroll_run",
                runId,
                JsonSerializer.Serialize(new { request.Month, request.Year }));

            return (await _repository.GetRunAsync(runId))!;
        }

        public Task<List<PayrollRunDto>> GetRunsAsync() => _repository.GetRunsAsync();

        public Task<PayrollRunDto?> GetRunAsync(long id) => _repository.GetRunAsync(id);

        public async Task<PayslipListResponse> GetRunPayslipsAsync(
            long runId,
            PayrollRunPayslipsQuery query)
        {
            var run = await _repository.GetRunAsync(runId);
            if (run is null)
            {
                throw new PayrollNotFoundException("Payroll run not found.");
            }

            string? status = null;
            if (!string.IsNullOrWhiteSpace(query.Status))
            {
                status = PayslipStatuses.All.FirstOrDefault(
                    s => string.Equals(s, query.Status.Trim(), StringComparison.OrdinalIgnoreCase));

                if (status is null)
                {
                    throw new PayrollValidationException("Invalid payslip status.");
                }
            }

            var page = Math.Max(1, query.Page);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);

            var (items, total) = await _repository.GetPayslipSummariesAsync(
                runId,
                query.Search,
                status,
                page,
                pageSize);

            return new PayslipListResponse
            {
                Items = items,
                Total = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<PayslipDto?> GetPayslipAsync(long id)
        {
            var payslip = await _repository.GetPayslipAsync(id);
            return payslip is null ? null : ToDto(payslip);
        }

        public Task<List<PayslipSummaryDto>> GetMyPayslipsAsync(
            int employeeId,
            int? year)
        {
            if (year is < 2000 or > 2100)
            {
                throw new PayrollValidationException("Year must be between 2000 and 2100.");
            }

            return _repository.GetEmployeePayslipsAsync(employeeId, year);
        }

        public async Task<PayslipDto?> GetMyPayslipAsync(int employeeId, long payslipId)
        {
            var payslip = await _repository.GetEmployeePayslipAsync(
                payslipId,
                employeeId);
            return payslip is null ? null : ToDto(payslip);
        }

        public async Task<PayslipDto?> GetMyLatestPayslipAsync(int employeeId)
        {
            var payslip = await _repository.GetLatestEmployeePayslipAsync(employeeId);
            return payslip is null ? null : ToDto(payslip);
        }

        public async Task<PayslipDownloadDto?> GetMyPayslipDownloadAsync(
            int employeeId,
            long payslipId,
            CancellationToken cancellationToken = default)
        {
            var payslip = await _repository.GetEmployeePayslipAsync(
                payslipId,
                employeeId);

            if (payslip is null)
            {
                return null;
            }

            var relativePath = payslip.PdfPath;
            string? fullPath = null;

            if (!string.IsNullOrWhiteSpace(relativePath))
            {
                try
                {
                    fullPath = _payslipPdfService.GetAbsolutePath(relativePath);
                }
                catch (InvalidOperationException)
                {
                    fullPath = null;
                }
            }

            if (fullPath is null || !File.Exists(fullPath))
            {
                relativePath = await _payslipPdfService.GeneratePayslipAsync(
                    payslip.Id,
                    cancellationToken);
                fullPath = _payslipPdfService.GetAbsolutePath(relativePath);
            }

            if (!File.Exists(fullPath))
            {
                throw new PayrollConflictException(
                    "Payslip PDF is not available yet. Please try again later.");
            }

            return new PayslipDownloadDto
            {
                FullPath = fullPath,
                FileName = BuildPayslipFileName(payslip)
            };
        }

        public async Task<List<PayslipSummaryDto>?> GetPayslipVersionsAsync(long id)
        {
            var payslip = await _repository.GetPayslipAsync(id);
            if (payslip is null)
            {
                return null;
            }

            return await _repository.GetPayslipVersionsAsync(
                payslip.RunId,
                payslip.EmployeeId);
        }

        public async Task<PayslipDto> ReissuePayslipAsync(
            long id,
            ReissuePayslipRequest request,
            int userId)
        {
            var reason = request.Reason?.Trim();
            if (string.IsNullOrWhiteSpace(reason))
            {
                throw new PayrollValidationException("Reissue reason is required.");
            }

            if (reason.Length > 500)
            {
                throw new PayrollValidationException("Reissue reason cannot exceed 500 characters.");
            }

            var payslip = await _repository.GetPayslipAsync(id);
            if (payslip is null)
            {
                throw new PayrollNotFoundException("Payslip not found.");
            }

            var run = await _repository.GetRunAsync(payslip.RunId);
            if (run is null)
            {
                throw new PayrollNotFoundException("Payroll run not found.");
            }

            if (run.Status != PayrollRunStatuses.Published ||
                payslip.Status != PayslipStatuses.Published)
            {
                throw new PayrollConflictException(
                    "Only published payslips can be reissued.");
            }

            var latest = await _repository.GetLatestPayslipAsync(
                payslip.RunId,
                payslip.EmployeeId);

            if (latest is null || latest.Id != payslip.Id)
            {
                throw new PayrollConflictException(
                    "Only the latest payslip version can be reissued.");
            }

            var reissued = await _repository.ReissuePayslipAsync(payslip.Id);
            if (reissued is null)
            {
                throw new PayrollConflictException(
                    "Payslip could not be reissued. It may have changed; refresh and try again.");
            }

            await _repository.AddAuditAsync(
                userId,
                "PAYSLIP_REISSUED",
                "payslip",
                reissued.Id,
                JsonSerializer.Serialize(new
                {
                    FromVersion = payslip.Version,
                    ToVersion = reissued.Version,
                    Reason = reason
                }));

            return ToDto(reissued);
        }

        public async Task<List<PayrollJobDto>?> GetRunJobsAsync(long runId)
        {
            if (await _repository.GetRunAsync(runId) is null)
            {
                return null;
            }

            var jobs = await _repository.GetJobsForRunAsync(runId);
            return jobs.Select(ToDto).ToList();
        }

        public async Task<AddAdjustmentResult> AddAdjustmentAsync(
            long payslipId,
            AddPayslipAdjustmentRequest request,
            int userId)
        {
            var type = NormalizeAdjustmentType(request.Type);
            if (type is null)
            {
                throw new PayrollValidationException("Invalid adjustment type.");
            }

            if (request.Amount == 0m)
            {
                throw new PayrollValidationException("Adjustment amount cannot be zero.");
            }

            var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            if (note?.Length > 500)
            {
                throw new PayrollValidationException("Adjustment note cannot exceed 500 characters.");
            }

            var payslip = await _repository.GetPayslipAsync(payslipId);
            if (payslip is null)
            {
                throw new PayrollNotFoundException("Payslip not found.");
            }

            var run = await _repository.GetRunAsync(payslip.RunId);
            if (run is null)
            {
                throw new PayrollNotFoundException("Payroll run not found.");
            }

            if (run.Status != PayrollRunStatuses.Draft)
            {
                throw new PayrollConflictException(
                    "Adjustments can only be added to draft payroll runs.");
            }

            var adjustment = await _repository.CreateAdjustmentAsync(
                payslipId,
                type,
                Money.Round(request.Amount),
                note,
                userId);

            if (adjustment is null)
            {
                throw new PayrollConflictException(
                    "Adjustment could not be added because the payroll run is no longer editable.");
            }

            var jobId = await _repository.EnqueueRunJobAsync(
                payslip.RunId,
                PayrollJobTypes.CalculateRun);

            await _repository.AddAuditAsync(
                userId,
                "PAYSLIP_ADJUSTMENT_ADDED",
                "payslip",
                payslipId,
                JsonSerializer.Serialize(new { Type = type }));

            return new AddAdjustmentResult
            {
                AdjustmentId = adjustment.Id,
                PayslipId = payslipId,
                RunId = payslip.RunId,
                JobId = jobId,
                Message = "Adjustment added. Payroll recalculation is queued."
            };
        }

        public async Task<PayrollRunDto?> QueueRecalculationAsync(long runId, int userId)
        {
            var run = await _repository.GetRunAsync(runId);
            if (run is null)
            {
                return null;
            }

            if (run.Status != PayrollRunStatuses.Draft)
            {
                throw new PayrollConflictException(
                    "Only draft payroll runs can be recalculated.");
            }

            var jobId = await _repository.EnqueueRunJobAsync(
                runId,
                PayrollJobTypes.CalculateRun);

            await _repository.AddAuditAsync(
                userId,
                "PAYROLL_RUN_RECALCULATION_QUEUED",
                "payroll_run",
                runId,
                JsonSerializer.Serialize(new { JobId = jobId }));

            return run;
        }

        public async Task<PayrollRunDto> ApproveRunAsync(long runId, int userId)
        {
            var run = await _repository.GetRunAsync(runId);
            if (run is null)
            {
                throw new PayrollNotFoundException("Payroll run not found.");
            }

            if (run.Status != PayrollRunStatuses.Draft)
            {
                throw new PayrollConflictException("Only draft payroll runs can be approved.");
            }

            if (await _repository.GetActiveRunJobIdAsync(runId, PayrollJobTypes.CalculateRun) is not null)
            {
                throw new PayrollConflictException("Payroll calculation is still in progress.");
            }

            if (await _repository.CountPayslipsAsync(runId) == 0)
            {
                throw new PayrollConflictException("This payroll run has no payslips to approve.");
            }

            try
            {
                await _attendanceRegisterService.ValidatePayrollAsync(run.Year, run.Month, runId);
            }
            catch (AttendanceRegisterConflictException ex)
            {
                throw new PayrollConflictException(ex.Message);
            }

            if (!await _repository.ApproveRunAsync(runId, userId, DateTime.UtcNow))
            {
                throw new PayrollConflictException("Payroll run status changed; refresh and try again.");
            }

            await _repository.AddAuditAsync(
                userId,
                "PAYROLL_RUN_APPROVED",
                "payroll_run",
                runId,
                "{}");

            return (await _repository.GetRunAsync(runId))!;
        }

        public async Task<PayrollRunDto> PublishRunAsync(long runId, int userId)
        {
            var run = await _repository.GetRunAsync(runId);
            if (run is null)
            {
                throw new PayrollNotFoundException("Payroll run not found.");
            }

            if (run.Status != PayrollRunStatuses.Approved)
            {
                throw new PayrollConflictException("Only approved payroll runs can be published.");
            }

            if (!await _repository.PublishRunAsync(runId, DateTime.UtcNow))
            {
                throw new PayrollConflictException("Payroll run status changed; refresh and try again.");
            }

            await _repository.AddAuditAsync(
                userId,
                "PAYROLL_RUN_PUBLISHED",
                "payroll_run",
                runId,
                "{}");

            return (await _repository.GetRunAsync(runId))!;
        }

        public async Task ProcessRunAsync(long runId, CancellationToken cancellationToken)
        {
            var run = await _repository.GetRunAsync(runId);
            if (run is null)
            {
                throw new PayrollNotFoundException("Payroll run not found.");
            }

            if (run.Status != PayrollRunStatuses.Draft)
            {
                throw new PayrollConflictException("Only draft payroll runs can be calculated.");
            }

            var today = DateTime.Today;
            var daysInMonth = DateTime.DaysInMonth(run.Year, run.Month);
            var monthStart = new DateTime(run.Year, run.Month, 1);
            var monthEnd = monthStart.AddDays(daysInMonth - 1);

            if (monthStart > new DateTime(today.Year, today.Month, 1))
            {
                throw new PayrollConflictException("Future payroll runs are not allowed.");
            }

            var dataCutoff = monthEnd < today ? monthEnd : today;

            var employees = await _repository.GetPayrollEmployeesAsync(dataCutoff);
            var adjustmentRows = await _repository.GetRunAdjustmentsAsync(runId);
            var rules = (await _repository.GetDeductionRulesAsync())
                .Where(rule => rule.IsActive)
                .ToList();
            var (registerSettings, registerRows) =
                await _attendanceRegisterService.BuildForPayrollAsync(run.Year, run.Month);
            var registerByEmployee = registerRows.ToDictionary(row => row.EmployeeId);
            var adjustmentsByEmployee = adjustmentRows
                .GroupBy(adjustment => adjustment.EmployeeId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(row => row.ToAdjustment()).ToList());

            var processed = 0;

            foreach (var employee in employees)
            {
                cancellationToken.ThrowIfCancellationRequested();

                registerByEmployee.TryGetValue(employee.EmployeeId, out var registerRow);

                var employeeAdjustments = adjustmentsByEmployee.TryGetValue(
                    employee.EmployeeId,
                    out var adjustmentRowsForEmployee)
                    ? adjustmentRowsForEmployee
                    : Enumerable.Empty<PayslipAdjustment>();

                var lopDays = registerRow?.Totals.LopDays ?? 0m;
                var daysInMonthForEmployee = registerRow?.Totals.DaysInMonth ?? daysInMonth;
                var warnings = new List<string>();

                if (registerRow is null)
                    warnings.Add("Attendance register row is missing for this employee.");
                else
                {
                    if (registerRow.Totals.Pending > 0)
                        warnings.Add($"{registerRow.Totals.Pending:0.##} attendance day(s) are still pending.");
                    if (registerRow.Totals.Dash > 0)
                        warnings.Add($"{registerRow.Totals.Dash:0.##} day(s) are outside the employee's employment period.");
                }

                PayrollCalculationResult calculation;
                if (employee.SalaryStructureId.HasValue && employee.Basic.HasValue)
                {
                    var salary = new SalaryStructure
                    {
                        Id = employee.SalaryStructureId.Value,
                        EmployeeId = employee.EmployeeId,
                        Basic = employee.Basic.Value,
                        Hra = employee.Hra ?? 0m,
                        Allowances = employee.Allowances ?? 0m,
                        EffectiveFrom = employee.EffectiveFrom ?? monthStart
                    };

                    calculation = PayrollCalculator.Calculate(
                        salary,
                        run.Year,
                        run.Month,
                        lopDays,
                        rules,
                        employeeAdjustments);

                    warnings.AddRange(calculation.Warnings);
                }
                else
                {
                    warnings.Add("Salary structure is missing or not effective for this month.");
                    calculation = new PayrollCalculationResult
                    {
                        DaysInMonth = daysInMonthForEmployee,
                        LopDays = lopDays,
                        LopAmount = 0m,
                        Gross = 0m,
                        Adjustments = 0m,
                        TotalDeductions = 0m,
                        NetPay = 0m,
                        Items = new List<PayslipLineItemDto>()
                    };
                }

                await _repository.UpsertPayslipAsync(
                    run.Id,
                    employee.EmployeeId,
                    1,
                    calculation.Gross,
                    calculation.LopDays,
                    calculation.LopAmount,
                    calculation.Adjustments,
                    calculation.TotalDeductions,
                    calculation.NetPay,
                    JsonSerializer.Serialize(calculation.Items),
                    JsonSerializer.Serialize(warnings));

                processed++;
            }

            await _attendanceRegisterService.EnsurePayrollLockAsync(
                run.Year,
                run.Month,
                run.Id,
                run.CreatedBy,
                registerRows,
                registerSettings);

            await _repository.AddAuditAsync(
                null,
                "PAYROLL_RUN_CALCULATED",
                "payroll_run",
                run.Id,
                JsonSerializer.Serialize(new { Processed = processed }));
        }

        public async Task<List<SalaryStructureDto>> GetSalaryStructuresAsync(int? employeeId)
        {
            var rows = await _repository.GetSalaryStructuresAsync(employeeId);
            return rows.Select(ToDto).ToList();
        }

        public async Task<SalaryStructureDto> CreateSalaryStructureAsync(
            CreateSalaryStructureRequest request,
            int userId)
        {
            if (request.EmployeeId <= 0)
            {
                throw new PayrollValidationException("Employee is required.");
            }

            if (request.EffectiveFrom == default)
            {
                throw new PayrollValidationException("Effective date is required.");
            }

            if (request.Basic < 0m || request.Hra < 0m || request.Allowances < 0m)
            {
                throw new PayrollValidationException("Salary amounts cannot be negative.");
            }

            if (!await _repository.EmployeeExistsAsync(request.EmployeeId))
            {
                throw new PayrollValidationException("Employee not found.");
            }

            var created = await _repository.CreateSalaryStructureAsync(new SalaryStructure
            {
                EmployeeId = request.EmployeeId,
                Basic = Money.Round(request.Basic),
                Hra = Money.Round(request.Hra),
                Allowances = Money.Round(request.Allowances),
                EffectiveFrom = request.EffectiveFrom.Date,
                CreatedBy = userId
            });

            await _repository.AddAuditAsync(
                userId,
                "PAYROLL_SALARY_STRUCTURE_CREATED",
                "salary_structure",
                created.Id,
                JsonSerializer.Serialize(new { created.EmployeeId }));

            return ToDto(created);
        }

        public async Task<List<DeductionRuleDto>> GetDeductionRulesAsync()
        {
            var rows = await _repository.GetDeductionRulesAsync();
            return rows.Select(ToDto).ToList();
        }

        public async Task<DeductionRuleDto> CreateDeductionRuleAsync(
            CreateDeductionRuleRequest request)
        {
            var name = NormalizeName(request.Name, "Deduction rule name is required.");
            var type = NormalizeDeductionType(request.Type);

            if (type is null)
            {
                throw new PayrollValidationException("Invalid deduction rule type.");
            }

            if (request.Value < 0m)
            {
                throw new PayrollValidationException("Deduction value cannot be negative.");
            }

            if (await _repository.DeductionRuleNameExistsAsync(name, null))
            {
                throw new PayrollConflictException("A deduction rule with this name already exists.");
            }

            var created = await _repository.CreateDeductionRuleAsync(new DeductionRule
            {
                Name = name,
                Type = type,
                Value = request.Value,
                IsActive = request.IsActive
            });

            await _repository.AddAuditAsync(
                null,
                "PAYROLL_DEDUCTION_RULE_CREATED",
                "deduction_rule",
                created.Id,
                JsonSerializer.Serialize(new { created.Name, created.Type }));

            return ToDto(created);
        }

        public async Task<DeductionRuleDto?> UpdateDeductionRuleAsync(
            long id,
            UpdateDeductionRuleRequest request)
        {
            var name = NormalizeName(request.Name, "Deduction rule name is required.");
            var type = NormalizeDeductionType(request.Type);

            if (type is null)
            {
                throw new PayrollValidationException("Invalid deduction rule type.");
            }

            if (request.Value < 0m)
            {
                throw new PayrollValidationException("Deduction value cannot be negative.");
            }

            if (await _repository.DeductionRuleNameExistsAsync(name, id))
            {
                throw new PayrollConflictException("A deduction rule with this name already exists.");
            }

            var updated = await _repository.UpdateDeductionRuleAsync(id, new DeductionRule
            {
                Name = name,
                Type = type,
                Value = request.Value,
                IsActive = request.IsActive
            });

            if (updated is null)
            {
                return null;
            }

            await _repository.AddAuditAsync(
                null,
                "PAYROLL_DEDUCTION_RULE_UPDATED",
                "deduction_rule",
                id,
                JsonSerializer.Serialize(new { updated.Name, updated.Type, updated.IsActive }));

            return ToDto(updated);
        }

        public async Task<List<PayrollHolidayDto>> GetHolidaysAsync(int? year)
        {
            if (year is < 2000 or > 2100)
            {
                throw new PayrollValidationException("Year must be between 2000 and 2100.");
            }

            var rows = await _repository.GetHolidaysAsync(year);
            return rows.Select(ToDto).ToList();
        }

        public async Task<PayrollHolidayDto> CreateHolidayAsync(
            CreateHolidayRequest request,
            int userId)
        {
            if (request.Date == default)
            {
                throw new PayrollValidationException("Holiday date is required.");
            }

            if (request.Date.Year is < 2000 or > 2100)
            {
                throw new PayrollValidationException("Holiday year must be between 2000 and 2100.");
            }

            var name = NormalizeName(request.Name, "Holiday name is required.");

            if (await _repository.HolidayExistsAsync(request.Date.Date))
            {
                throw new PayrollConflictException("A holiday already exists on this date.");
            }

            var created = await _repository.CreateHolidayAsync(
                request.Date.Date,
                name,
                userId);

            await _repository.AddAuditAsync(
                userId,
                "PAYROLL_HOLIDAY_CREATED",
                "payroll_holiday",
                created.Id,
                JsonSerializer.Serialize(new { created.HolidayDate, created.Name }));

            return ToDto(created);
        }

        public async Task<bool> DeleteHolidayAsync(long id)
        {
            var deleted = await _repository.DeleteHolidayAsync(id);
            if (deleted)
            {
                await _repository.AddAuditAsync(
                    null,
                    "PAYROLL_HOLIDAY_DELETED",
                    "payroll_holiday",
                    id,
                    "{}");
            }

            return deleted;
        }

        public async Task<List<int>> GetWeekOffDaysAsync()
        {
            var rows = await _repository.GetWeekOffDaysAsync();
            return rows.Select(row => (int)row.DayOfWeek).ToList();
        }

        public async Task<List<int>> SetWeekOffDaysAsync(SetWeekOffRequest request, int userId)
        {
            var days = (request.Days ?? Array.Empty<int>())
                .Distinct()
                .OrderBy(day => day)
                .ToArray();

            if (days.Any(day => day is < 0 or > 6))
            {
                throw new PayrollValidationException("Week-off days must be between 0 and 6.");
            }

            await _repository.ReplaceWeekOffDaysAsync(days);

            await _repository.AddAuditAsync(
                userId,
                "PAYROLL_WEEK_OFF_UPDATED",
                "payroll_week_off",
                null,
                JsonSerializer.Serialize(new { Days = days }));

            return days.ToList();
        }

        private static string BuildPayslipFileName(Payslip payslip)
        {
            var code = string.IsNullOrWhiteSpace(payslip.EmployeeCode)
                ? payslip.EmployeeId.ToString()
                : payslip.EmployeeCode;

            var safeCode = new string(code
                .Select(character =>
                    char.IsLetterOrDigit(character) || character is '-' or '_'
                        ? character
                        : '_')
                .ToArray());

            return $"Payslip-{safeCode}-{payslip.Year}-{payslip.Month:00}-v{payslip.Version}.pdf";
        }

        private static PayslipDto ToDto(Payslip payslip)
        {
            var items = Deserialize<List<PayslipLineItemDto>>(payslip.Items);
            var warnings = Deserialize<List<string>>(payslip.Warnings);

            return new PayslipDto
            {
                Id = payslip.Id,
                RunId = payslip.RunId,
                EmployeeId = payslip.EmployeeId,
                EmployeeName = payslip.EmployeeName,
                EmployeeCode = payslip.EmployeeCode,
                DesignationTitle = payslip.DesignationTitle,
                Month = payslip.Month,
                Year = payslip.Year,
                Version = payslip.Version,
                Gross = payslip.Gross,
                LopDays = payslip.LopDays,
                LopAmount = payslip.LopAmount,
                Adjustments = payslip.Adjustments,
                TotalDeductions = payslip.TotalDeductions,
                NetPay = payslip.NetPay,
                Items = items,
                Warnings = warnings,
                Status = payslip.Status,
                CreatedAt = payslip.CreatedAt
            };
        }

        private static SalaryStructureDto ToDto(SalaryStructure structure) => new()
        {
            Id = structure.Id,
            EmployeeId = structure.EmployeeId,
            EmployeeName = structure.EmployeeName,
            EmployeeCode = structure.EmployeeCode,
            Basic = structure.Basic,
            Hra = structure.Hra,
            Allowances = structure.Allowances,
            EffectiveFrom = structure.EffectiveFrom,
            CreatedBy = structure.CreatedBy,
            CreatedAt = structure.CreatedAt
        };

        private static DeductionRuleDto ToDto(DeductionRule rule) => new()
        {
            Id = rule.Id,
            Name = rule.Name,
            Type = rule.Type,
            Value = rule.Value,
            IsActive = rule.IsActive
        };

        private static PayrollHolidayDto ToDto(PayrollHoliday holiday) => new()
        {
            Id = holiday.Id,
            Date = holiday.HolidayDate,
            Name = holiday.Name
        };

        private static PayrollJobDto ToDto(PayrollJob job) => new()
        {
            Id = job.Id,
            Type = job.Type,
            RunId = job.RunId,
            PayslipId = job.PayslipId,
            Status = job.Status,
            Attempts = job.Attempts,
            Error = job.Error,
            CreatedAt = job.CreatedAt,
            UpdatedAt = job.UpdatedAt
        };

        private static T Deserialize<T>(string? json) where T : new()
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new T();
            }

            try
            {
                return JsonSerializer.Deserialize<T>(json) ?? new T();
            }
            catch (JsonException)
            {
                return new T();
            }
        }

        private static string NormalizeName(string? value, string message)
        {
            var name = value?.Trim() ?? string.Empty;

            if (name.Length == 0)
            {
                throw new PayrollValidationException(message);
            }

            if (name.Length > 100)
            {
                throw new PayrollValidationException("Name cannot exceed 100 characters.");
            }

            return name;
        }

        private static string? NormalizeDeductionType(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return DeductionTypes.All.FirstOrDefault(
                type => string.Equals(type, value.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        private static string? NormalizeAdjustmentType(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return AdjustmentTypes.All.FirstOrDefault(
                type => string.Equals(type, value.Trim(), StringComparison.OrdinalIgnoreCase));
        }
    }
}
