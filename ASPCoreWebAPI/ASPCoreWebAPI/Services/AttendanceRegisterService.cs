using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using System.Globalization;
using System.Text.Json;

namespace ASPCoreWebAPI.Services
{
    public interface IAttendanceRegisterService
    {
        Task<AttendanceRegisterResponse> GetRegisterAsync(AttendanceRegisterQuery query, RegisterActor actor);
        Task<AttendanceRegisterCellDto> GetCellAsync(int employeeId, string date, RegisterActor actor);
        Task MarkAsync(AttendanceRegisterMarkRequest request, RegisterActor actor);
        Task<AttendanceRegisterLockDto> LockAsync(AttendanceRegisterLockRequest request, RegisterActor actor);
        Task<List<AttendanceRegisterLockDto>> GetLockHistoryAsync(string month);
        Task<AttendanceRegisterSettingsDto> UpdateSettingsAsync(
            AttendanceRegisterSettingsUpdateRequest request,
            RegisterActor actor);
        Task<Dictionary<int, PayrollRegisterTotalsDto>> GetPayrollTotalsAsync(string month);
        Task<(AttendanceRegisterSettingsDto Settings, List<AttendanceRegisterRowDto> Rows)> BuildForPayrollAsync(
            int year,
            int month);
        Task EnsurePayrollLockAsync(
            int year,
            int month,
            long payrollRunId,
            int? userId,
            IReadOnlyList<AttendanceRegisterRowDto> rows,
            AttendanceRegisterSettingsDto settings);
        Task ValidatePayrollAsync(int year, int month, long payrollRunId);
    }

    public sealed class AttendanceRegisterForbiddenException : Exception
    {
        public AttendanceRegisterForbiddenException(string message) : base(message)
        {
        }
    }

    public sealed class AttendanceRegisterValidationException : Exception
    {
        public AttendanceRegisterValidationException(string message) : base(message)
        {
        }
    }

    public sealed class AttendanceRegisterConflictException : Exception
    {
        public AttendanceRegisterConflictException(string message) : base(message)
        {
        }
    }

    public class AttendanceRegisterService : IAttendanceRegisterService
    {
        private static readonly JsonSerializerOptions SnapshotJsonOptions = new();
        private readonly IAttendanceRegisterRepository _repo;
        private readonly ILogger<AttendanceRegisterService> _logger;

        public AttendanceRegisterService(
            IAttendanceRegisterRepository repo,
            ILogger<AttendanceRegisterService> logger)
        {
            _repo = repo;
            _logger = logger;
        }

        public async Task<AttendanceRegisterResponse> GetRegisterAsync(
            AttendanceRegisterQuery query,
            RegisterActor actor)
        {
            var (year, month) = ParseMonth(query.Month);
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var daysInMonth = DateTime.DaysInMonth(year, month);
            var settings = await _repo.GetSettingsAsync();
            var lockRow = await _repo.GetLatestLockAsync(year, month);
            var filters = await BuildFilterOptionsAsync();

            var response = new AttendanceRegisterResponse
            {
                Month = $"{year:D4}-{month:D2}",
                Year = year,
                MonthNumber = month,
                DaysInMonth = daysInMonth,
                Page = Math.Max(1, query.Page),
                PageSize = Math.Clamp(query.PageSize, 1, 200),
                Settings = settings,
                Filters = filters,
                Legend = BuildLegend()
            };

            if (lockRow is not null)
            {
                var lockedRows = await BuildLockedRowsAsync(lockRow, query);
                response.Locked = true;
                response.LockId = lockRow.Id;
                response.LockVersion = lockRow.Version;
                response.LockedAt = lockRow.LockedAt;
                response.LockedBy = lockRow.LockedByName;
                response.LockReason = lockRow.Reason;
                response.Settings = DeserializeSettings(lockRow.SettingsJson, settings);
                response.Total = lockedRows.Count;
                response.GrandTotals = SumTotals(lockedRows);
                response.Items = lockedRows
                    .Skip((response.Page - 1) * response.PageSize)
                    .Take(response.PageSize)
                    .ToList();
                return response;
            }

            var visibleIds = await ResolveVisibleEmployeeIdsAsync(actor);
            var employees = await _repo.GetEmployeesAsync(monthStart, monthEnd, query, visibleIds);
            var rows = await BuildRowsAsync(employees, monthStart, monthEnd, settings, actor, false);

            response.Total = rows.Count;
            response.GrandTotals = SumTotals(rows);
            response.Items = rows
                .Skip((response.Page - 1) * response.PageSize)
                .Take(response.PageSize)
                .ToList();
            return response;
        }

        public async Task<AttendanceRegisterCellDto> GetCellAsync(
            int employeeId,
            string date,
            RegisterActor actor)
        {
            if (!DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var parsedDate))
                throw new AttendanceRegisterValidationException("Date must use yyyy-MM-dd format.");

            var monthStart = new DateTime(parsedDate.Year, parsedDate.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var settings = await _repo.GetSettingsAsync();
            var lockRow = await _repo.GetLatestLockAsync(parsedDate.Year, parsedDate.Month);

            if (lockRow is not null)
            {
                var snapshot = (await _repo.GetSnapshotsAsync(lockRow.Id))
                    .FirstOrDefault(x => x.EmployeeId == employeeId);
                var day = snapshot is null
                    ? null
                    : JsonSerializer.Deserialize<List<AttendanceRegisterDayDto>>(
                        snapshot.DaysJson, SnapshotJsonOptions)?
                        .FirstOrDefault(x => x.Date == parsedDate.ToString("yyyy-MM-dd"));

                if (day is null)
                    throw new AttendanceRegisterValidationException("No register entry found for this employee and date.");

                return new AttendanceRegisterCellDto
                {
                    EmployeeId = employeeId,
                    EmployeeCode = snapshot?.EmployeeCode ?? string.Empty,
                    EmployeeName = snapshot?.EmployeeName ?? string.Empty,
                    Date = day.Date,
                    Code = day.Code,
                    LeaveType = day.LeaveType,
                    LeaveIsPaid = day.LeaveIsPaid,
                    HalfDayLeave = day.HalfDayLeave,
                    HolidayName = day.HolidayName,
                    IsWeekOff = day.IsWeekOff,
                    IsPending = day.IsPending,
                    IsFuture = day.IsFuture,
                    IsBeforeJoining = day.IsBeforeJoining,
                    IsAfterExit = day.IsAfterExit,
                    MultiShift = day.MultiShift,
                    WorkingHours = day.WorkingHours,
                    Flags = day.Flags,
                    AttendanceId = day.AttendanceId,
                    LeaveId = day.LeaveId,
                    ShiftIds = day.ShiftIds,
                    CanMark = false,
                    Locked = true,
                    Segments = day.Segments,
                    Leave = day.Leave,
                    Holiday = day.Holiday
                };
            }

            var visibleIds = await ResolveVisibleEmployeeIdsAsync(actor);
            if (visibleIds is not null && !visibleIds.Contains(employeeId))
                throw new AttendanceRegisterForbiddenException("You do not have access to this employee.");

            var employeeQuery = new AttendanceRegisterQuery
            {
                Month = $"{parsedDate.Year:D4}-{parsedDate.Month:D2}",
                Page = 1,
                PageSize = 500
            };
            var employees = (await _repo.GetEmployeesAsync(monthStart, monthEnd, employeeQuery, visibleIds))
                .Where(x => x.EmployeeId == employeeId)
                .ToList();
            if (employees.Count == 0)
                throw new AttendanceRegisterValidationException("Employee not found in this month.");

            var rows = await BuildRowsAsync(employees, monthStart, monthEnd, settings, actor, false);
            var row = rows.First();
            var dayDto = row.Days.FirstOrDefault(x => x.Date == parsedDate.ToString("yyyy-MM-dd"));
            if (dayDto is null)
                throw new AttendanceRegisterValidationException("Register entry not found.");

            return new AttendanceRegisterCellDto
            {
                EmployeeId = row.EmployeeId,
                EmployeeCode = row.EmployeeCode,
                EmployeeName = row.EmployeeName,
                Date = dayDto.Date,
                Code = dayDto.Code,
                LeaveType = dayDto.LeaveType,
                LeaveIsPaid = dayDto.LeaveIsPaid,
                HalfDayLeave = dayDto.HalfDayLeave,
                HolidayName = dayDto.HolidayName,
                IsWeekOff = dayDto.IsWeekOff,
                IsPending = dayDto.IsPending,
                IsFuture = dayDto.IsFuture,
                IsBeforeJoining = dayDto.IsBeforeJoining,
                IsAfterExit = dayDto.IsAfterExit,
                MultiShift = dayDto.MultiShift,
                WorkingHours = dayDto.WorkingHours,
                Flags = dayDto.Flags,
                AttendanceId = dayDto.AttendanceId,
                LeaveId = dayDto.LeaveId,
                ShiftIds = dayDto.ShiftIds,
                CanMark = dayDto.CanMark,
                Locked = dayDto.Locked,
                Segments = dayDto.Segments,
                Leave = dayDto.Leave,
                Holiday = dayDto.Holiday
            };
        }

        public async Task MarkAsync(AttendanceRegisterMarkRequest request, RegisterActor actor)
        {
            if (!actor.IsOwnerOrHr)
                throw new AttendanceRegisterForbiddenException("Only OWNER or HR can mark attendance.");

            if (!DateTime.TryParseExact(request.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var date))
                throw new AttendanceRegisterValidationException("Date must use yyyy-MM-dd format.");

            if (date.Date > DateTime.Today)
                throw new AttendanceRegisterValidationException("Future dates cannot be marked.");

            if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 5)
                throw new AttendanceRegisterValidationException("Reason must be at least 5 characters.");

            var code = (request.Status ?? string.Empty).Trim().ToUpperInvariant();
            if (code is not ("P" or "LT" or "HD" or "A" or "L" or "UL" or "H" or "WO"))
                throw new AttendanceRegisterValidationException("Status must be P, LT, HD, A, L, UL, H or WO.");

            var lockRow = await _repo.GetLatestLockAsync(date.Year, date.Month);
            if (lockRow is not null)
                throw new AttendanceRegisterConflictException("This month is locked. Reissue creates a new version.");

            var visibleIds = await ResolveVisibleEmployeeIdsAsync(actor);
            if (visibleIds is not null && !visibleIds.Contains(request.EmployeeId))
                throw new AttendanceRegisterForbiddenException("You do not have access to this employee.");

            await _repo.MarkAttendanceAsync(
                request.EmployeeId,
                date,
                request.ShiftAssignmentId,
                code,
                request.CheckInTime,
                request.CheckOutTime,
                actor.UserId,
                request.Reason.Trim());
        }

        public async Task<AttendanceRegisterLockDto> LockAsync(
            AttendanceRegisterLockRequest request,
            RegisterActor actor)
        {
            if (!actor.IsOwnerOrHr)
                throw new AttendanceRegisterForbiddenException("Only OWNER or HR can lock the register.");

            var (year, month) = ParseMonth(request.Month);
            var settings = await _repo.GetSettingsAsync();
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var employees = await _repo.GetEmployeesAsync(
                monthStart,
                monthEnd,
                new AttendanceRegisterQuery { Month = request.Month, Page = 1, PageSize = 500 },
                null);
            var rows = await BuildRowsAsync(employees, monthStart, monthEnd, settings, actor, false);
            var lockId = await _repo.CreateLockAsync(
                year,
                month,
                null,
                actor.UserId,
                request.Reason,
                JsonSerializer.Serialize(settings, SnapshotJsonOptions),
                BuildSnapshots(rows));

            var row = await _repo.GetLatestLockAsync(year, month);
            _logger.LogInformation("Attendance register {Year}-{Month} locked. LockId={LockId}, rows={Rows}",
                year, month, lockId, rows.Count);

            return new AttendanceRegisterLockDto
            {
                Id = lockId,
                Year = year,
                Month = month,
                Version = row?.Version ?? 1,
                LockedAt = row?.LockedAt ?? DateTime.UtcNow,
                LockedBy = row?.LockedByName,
                Reason = request.Reason,
                Settings = settings
            };
        }

        public async Task<List<AttendanceRegisterLockDto>> GetLockHistoryAsync(string month)
        {
            var (year, monthNumber) = ParseMonth(month);
            var rows = await _repo.GetLockHistoryAsync(year, monthNumber);
            return rows.Select(x => new AttendanceRegisterLockDto
            {
                Id = x.Id,
                Year = x.Year,
                Month = x.Month,
                Version = x.Version,
                PayrollRunId = x.PayrollRunId,
                LockedAt = x.LockedAt,
                LockedBy = x.LockedByName,
                Reason = x.Reason,
                Settings = DeserializeSettings(x.SettingsJson, new AttendanceRegisterSettingsDto())
            }).ToList();
        }

        public async Task<AttendanceRegisterSettingsDto> UpdateSettingsAsync(
            AttendanceRegisterSettingsUpdateRequest request,
            RegisterActor actor)
        {
            if (!actor.IsOwnerOrHr)
                throw new AttendanceRegisterForbiddenException("Only OWNER or HR can change register settings.");

            await _repo.UpdateSettingsAsync(
                request.SandwichRuleEnabled,
                request.HalfDayLopEnabled,
                actor.UserId);
            return await _repo.GetSettingsAsync();
        }

        public async Task<Dictionary<int, PayrollRegisterTotalsDto>> GetPayrollTotalsAsync(string month)
        {
            var (year, monthNumber) = ParseMonth(month);
            return await _repo.GetSnapshotTotalsAsync(year, monthNumber);
        }

        public async Task<(AttendanceRegisterSettingsDto Settings, List<AttendanceRegisterRowDto> Rows)> BuildForPayrollAsync(
            int year,
            int month)
        {
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var settings = await _repo.GetSettingsAsync();
            var employees = await _repo.GetEmployeesAsync(
                monthStart,
                monthEnd,
                new AttendanceRegisterQuery
                {
                    Month = $"{year:D4}-{month:D2}",
                    Page = 1,
                    PageSize = 500
                },
                null);
            var actor = new RegisterActor { Role = "SYSTEM", UserId = 0 };
            var rows = await BuildRowsAsync(employees, monthStart, monthEnd, settings, actor, false);
            return (settings, rows);
        }

        public async Task ValidatePayrollAsync(int year, int month, long payrollRunId)
        {
            var lockRow = await _repo.GetLockByPayrollRunAsync(payrollRunId);
            if (lockRow is null)
                return;

            var snapshotTotals = await _repo.GetSnapshotTotalsAsync(year, month);
            var payslipLop = await _repo.GetPayslipLopAsync(payrollRunId);
            var mismatches = new List<string>();

            foreach (var (employeeId, total) in snapshotTotals)
            {
                if (!payslipLop.TryGetValue(employeeId, out var lop))
                    continue;
                if (Math.Abs(lop - total.LopDays) > 0.005m)
                    mismatches.Add($"{employeeId}: payslip {lop:0.##}, register {total.LopDays:0.##}");
            }

            if (mismatches.Count > 0)
                throw new AttendanceRegisterConflictException(
                    "Attendance changed after payroll calculation. Recalculate payroll before approval. " +
                    string.Join("; ", mismatches.Take(5)));
        }

        public async Task EnsurePayrollLockAsync(
            int year,
            int month,
            long payrollRunId,
            int? userId,
            IReadOnlyList<AttendanceRegisterRowDto> rows,
            AttendanceRegisterSettingsDto settings)
        {
            var existing = await _repo.GetLockByPayrollRunAsync(payrollRunId);
            if (existing is not null)
                return;

            await _repo.CreateLockAsync(
                year,
                month,
                payrollRunId,
                userId,
                "Payroll run",
                JsonSerializer.Serialize(settings, SnapshotJsonOptions),
                BuildSnapshots(rows));
        }

        private async Task<int[]?> ResolveVisibleEmployeeIdsAsync(RegisterActor actor)
        {
            if (actor.IsOwnerOrHr)
                return null;

            if (actor.EmployeeId is null || !actor.IsManager || actor.ManagedEmployeeIds.Count == 0)
                throw new AttendanceRegisterForbiddenException("You do not have access to the attendance register.");

            return actor.ManagedEmployeeIds.ToArray();
        }

        private async Task<List<AttendanceRegisterRowDto>> BuildLockedRowsAsync(
            AttendanceRegisterLockRow lockRow,
            AttendanceRegisterQuery query)
        {
            var snapshots = await _repo.GetSnapshotsAsync(lockRow.Id);
            var rows = new List<AttendanceRegisterRowDto>();

            foreach (var snapshot in snapshots)
            {
                if (query.DepartmentId.HasValue && snapshot.DepartmentId != query.DepartmentId)
                    continue;
                if (query.LocationId.HasValue && snapshot.LocationId != query.LocationId)
                    continue;
                if (!string.IsNullOrWhiteSpace(query.Search))
                {
                    var search = query.Search.Trim();
                    if (!(snapshot.EmployeeName.Contains(search, StringComparison.OrdinalIgnoreCase)
                          || (snapshot.EmployeeCode ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase)))
                        continue;
                }
                if (query.ShiftId.HasValue && !snapshot.ShiftIds.Contains(query.ShiftId.Value))
                    continue;

                rows.Add(new AttendanceRegisterRowDto
                {
                    EmployeeId = snapshot.EmployeeId,
                    EmployeeCode = snapshot.EmployeeCode ?? string.Empty,
                    EmployeeName = snapshot.EmployeeName,
                    DepartmentId = snapshot.DepartmentId,
                    DepartmentName = snapshot.DepartmentName,
                    LocationId = snapshot.LocationId,
                    LocationName = snapshot.LocationName,
                    JoiningDate = snapshot.JoiningDate,
                    ExitDate = snapshot.ExitDate,
                    Status = snapshot.ExitDate.HasValue ? "Inactive" : "Active",
                    Days = JsonSerializer.Deserialize<List<AttendanceRegisterDayDto>>(
                        snapshot.DaysJson, SnapshotJsonOptions) ?? new(),
                    Totals = JsonSerializer.Deserialize<AttendanceRegisterTotalsDto>(
                        snapshot.TotalsJson, SnapshotJsonOptions) ?? new()
                });
            }

            return rows
                .OrderBy(x => x.DepartmentName)
                .ThenBy(x => x.EmployeeName)
                .ToList();
        }

        private async Task<List<AttendanceRegisterRowDto>> BuildRowsAsync(
            List<AttendanceRegisterEmployeeRow> employees,
            DateTime monthStart,
            DateTime monthEnd,
            AttendanceRegisterSettingsDto settings,
            RegisterActor actor,
            bool allowLocked)
        {
            var rows = new List<AttendanceRegisterRowDto>();
            if (employees.Count == 0)
                return rows;

            var employeeIds = employees.Select(x => x.EmployeeId).Distinct().ToArray();
            var shifts = await _repo.GetShiftsAsync(monthStart, monthEnd, employeeIds);
            var attendance = await _repo.GetAttendanceAsync(monthStart, monthEnd, employeeIds);
            var leaves = await _repo.GetLeavesAsync(monthStart, monthEnd, employeeIds);
            var holidays = await _repo.GetHolidaysAsync(monthStart, monthEnd);
            var weekOffDays = (await _repo.GetWeekOffDaysAsync()).ToHashSet();
            var today = DateTime.Today;
            var canMark = actor.IsOwnerOrHr;

            var shiftMap = shifts
                .GroupBy(x => (x.EmployeeId, x.ShiftDate.Date))
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.ShiftStart).ToList());
            var attendanceMap = attendance
                .GroupBy(x => (x.EmployeeId, x.AttendanceDate.Date))
                .ToDictionary(g => g.Key, g => g.ToList());
            var leaveMap = BuildLeaveMap(leaves, monthStart, monthEnd);
            var holidayMap = holidays
                .GroupBy(x => x.HolidayDate.Date)
                .ToDictionary(g => g.Key, g => g.First());

            foreach (var employee in employees)
            {
                var days = new List<DayComputation>();
                var joining = employee.JoiningDate?.Date;
                var exit = employee.ExitDate?.Date;

                for (var offset = 0; offset < DateTime.DaysInMonth(monthStart.Year, monthStart.Month); offset++)
                {
                    var date = monthStart.AddDays(offset);
                    shiftMap.TryGetValue((employee.EmployeeId, date), out var dayShifts);
                    attendanceMap.TryGetValue((employee.EmployeeId, date), out var dayAttendance);
                    leaveMap.TryGetValue((employee.EmployeeId, date), out var dayLeave);
                    holidayMap.TryGetValue(date, out var holiday);
                    var isWeekOff = weekOffDays.Contains((int)date.DayOfWeek);

                    var computed = ComputeDay(
                        date,
                        today,
                        dayShifts ?? new List<AttendanceRegisterShiftRow>(),
                        dayAttendance ?? new List<AttendanceRegisterAttendanceRow>(),
                        dayLeave,
                        holiday,
                        isWeekOff,
                        joining,
                        exit,
                        settings,
                        canMark);
                    days.Add(computed);
                }

                if (settings.SandwichRuleEnabled)
                    ApplySandwichRule(days);

                var row = new AttendanceRegisterRowDto
                {
                    EmployeeId = employee.EmployeeId,
                    EmployeeCode = employee.EmployeeCode ?? string.Empty,
                    EmployeeName = employee.EmployeeName ?? string.Empty,
                    Email = employee.Email,
                    DepartmentId = employee.DepartmentId,
                    DepartmentName = employee.DepartmentName,
                    LocationId = employee.LocationId,
                    LocationName = employee.LocationName,
                    ManagerId = employee.ManagerId,
                    ManagerName = employee.ManagerName,
                    JoiningDate = employee.JoiningDate,
                    ExitDate = employee.ExitDate,
                    ExitDateSource = employee.ExitDateSource,
                    Status = employee.Status ?? "Active",
                    Days = days.Select(x => x.Dto).ToList(),
                    Totals = BuildTotals(days, monthStart)
                };

                if (string.Equals(employee.ExitDateSource, "ESTIMATED", StringComparison.OrdinalIgnoreCase))
                    row.Days.FirstOrDefault()?.Flags.Add(AttendanceRegisterFlags.ExitDateEstimated);

                rows.Add(row);
            }

            return rows
                .OrderBy(x => x.DepartmentName)
                .ThenBy(x => x.EmployeeName)
                .ToList();
        }

        private DayComputation ComputeDay(
            DateTime date,
            DateTime today,
            List<AttendanceRegisterShiftRow> shifts,
            List<AttendanceRegisterAttendanceRow> attendance,
            AttendanceRegisterLeaveRow? leave,
            AttendanceRegisterHolidayRow? holiday,
            bool isWeekOff,
            DateTime? joining,
            DateTime? exit,
            AttendanceRegisterSettingsDto settings,
            bool canMark)
        {
            var dto = new AttendanceRegisterDayDto
            {
                Date = date.ToString("yyyy-MM-dd"),
                IsWeekOff = isWeekOff,
                HolidayName = holiday?.Name,
                IsFuture = date > today,
                IsBeforeJoining = joining.HasValue && date < joining.Value,
                IsAfterExit = exit.HasValue && date > exit.Value,
                MultiShift = shifts.Count > 1,
                ShiftIds = shifts.Select(x => x.ShiftId).Distinct().ToList(),
                AttendanceId = attendance.FirstOrDefault()?.Id,
                LeaveId = leave?.Id,
                LeaveType = leave?.LeaveType,
                LeaveIsPaid = leave?.IsPaid,
                HalfDayLeave = leave?.HalfDay ?? false,
                CanMark = canMark && !(date > today) && !(joining.HasValue && date < joining.Value)
                          && !(exit.HasValue && date > exit.Value),
                Holiday = holiday is null ? null : new AttendanceRegisterHolidayDto
                {
                    Id = holiday.Id,
                    Name = holiday.Name,
                    Date = holiday.HolidayDate.ToString("yyyy-MM-dd")
                },
                Leave = leave is null ? null : new AttendanceRegisterLeaveDto
                {
                    Id = leave.Id,
                    Type = leave.LeaveType,
                    IsPaid = leave.IsPaid,
                    HalfDay = leave.HalfDay,
                    Days = leave.Days,
                    From = leave.StartDate.ToString("yyyy-MM-dd"),
                    To = leave.EndDate.ToString("yyyy-MM-dd"),
                    Status = leave.Status
                }
            };

            dto.Segments = BuildSegments(shifts, attendance);
            dto.WorkingHours = dto.Segments.Sum(x => x.WorkingHours ?? 0);

            if (dto.IsBeforeJoining)
            {
                dto.Code = AttendanceRegisterCodes.Dash;
                dto.Flags.Add(AttendanceRegisterFlags.BeforeJoining);
                return DayComputation.Dash(dto);
            }

            if (dto.IsAfterExit)
            {
                dto.Code = AttendanceRegisterCodes.Dash;
                dto.Flags.Add(AttendanceRegisterFlags.AfterExit);
                return DayComputation.Dash(dto);
            }

            if (leave is not null && string.Equals(leave.Status, "Pending", StringComparison.OrdinalIgnoreCase)
                && attendance.Count == 0)
            {
                dto.Code = AttendanceRegisterCodes.Pending;
                dto.IsPending = true;
                dto.Flags.Add(AttendanceRegisterFlags.StatusConflict);
                return DayComputation.Pending(dto);
            }

            var approvedLeave = leave is not null
                                && string.Equals(leave.Status, "Approved", StringComparison.OrdinalIgnoreCase)
                ? leave
                : null;

            var attendanceCodes = dto.Segments
                .Where(x => !string.IsNullOrWhiteSpace(x.Status))
                .Select(x => ToDisplayCode(x.Status))
                .Where(x => x is not null)
                .Select(x => x!)
                .ToList();

            var workedSegments = dto.Segments.Count(x => IsWorkedStatus(x.Status));
            var attended = workedSegments > 0;

            if (shifts.Count > 1)
            {
                if (attended)
                {
                    var workedCodes = dto.Segments
                        .Where(x => IsWorkedStatus(x.Status))
                        .Select(x => ToDisplayCode(x.Status))
                        .Where(x => x is not null)
                        .Select(x => x!)
                        .ToList();
                    dto.Code = workedCodes.Any(x => x == AttendanceRegisterCodes.Late)
                        ? AttendanceRegisterCodes.Late
                        : workedCodes.All(x => x == AttendanceRegisterCodes.HalfDay)
                            ? AttendanceRegisterCodes.HalfDay
                            : AttendanceRegisterCodes.Present;
                    dto.Flags.Add(AttendanceRegisterFlags.MultiShift);

                    if (workedSegments < shifts.Count)
                        dto.Flags.Add(AttendanceRegisterFlags.PartialMultiShift);

                    dto.Code = ApplyLeaveOverlay(dto, approvedLeave, attended: true, dto.Code);
                    return BuildWorkedComputation(dto, approvedLeave, settings, attended: true);
                }
            }
            else if (attended)
            {
                var workedCode = attendanceCodes.FirstOrDefault(x =>
                    x is AttendanceRegisterCodes.Present
                        or AttendanceRegisterCodes.Late
                        or AttendanceRegisterCodes.HalfDay);

                dto.Code = workedCode ?? AttendanceRegisterCodes.Present;
                if (attendance.Any(x => x.Status is "Late" || x.IsLate))
                    dto.Code = AttendanceRegisterCodes.Late;
                if (attendance.Any(x => x.Status == "MissingPunch" || x.MissingPunchDetectedAt.HasValue))
                    dto.Flags.Add(AttendanceRegisterFlags.MissingCheckout);

                dto.Code = ApplyLeaveOverlay(dto, approvedLeave, attended: true, dto.Code);
                return BuildWorkedComputation(dto, approvedLeave, settings, attended: true);
            }

            var manualCode = attendance
                .Select(x => x.RegisterCode)
                .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));

            if (!string.IsNullOrWhiteSpace(manualCode))
            {
                dto.Code = manualCode!;
                if (manualCode is AttendanceRegisterCodes.LeavePaid or AttendanceRegisterCodes.LeaveUnpaid)
                {
                    dto.Flags.Add(manualCode == AttendanceRegisterCodes.LeavePaid
                        ? AttendanceRegisterFlags.PaidLeave
                        : AttendanceRegisterFlags.UnpaidLeave);
                    return new DayComputation(dto,
                        Payable: manualCode == AttendanceRegisterCodes.LeavePaid ? 1m : 0m,
                        Lop: manualCode == AttendanceRegisterCodes.LeavePaid ? 0m : 1m);
                }

                if (manualCode is AttendanceRegisterCodes.Holiday or "WO")
                    return new DayComputation(dto, Payable: 1m, Lop: 0m);

                if (manualCode == AttendanceRegisterCodes.Absent)
                    return new DayComputation(dto, Payable: 0m, Lop: 1m);
            }

            if (approvedLeave is not null)
            {
                var flags = dto.Flags;
                if (approvedLeave.IsPaid)
                    flags.Add(AttendanceRegisterFlags.PaidLeave);
                else
                    flags.Add(AttendanceRegisterFlags.UnpaidLeave);
                if (approvedLeave.HalfDay)
                    flags.Add(AttendanceRegisterFlags.HalfDayLeave);

                if (approvedLeave.HalfDay && approvedLeave.IsPaid)
                {
                    dto.Code = AttendanceRegisterCodes.HalfDay;
                    return new DayComputation(dto, Payable: 0.5m, Lop: 0.5m, HalfDayLop: 0.5m);
                }

                if (approvedLeave.IsPaid)
                {
                    dto.Code = AttendanceRegisterCodes.LeavePaid;
                    return new DayComputation(dto, Payable: 1m, Lop: 0m);
                }

                dto.Code = AttendanceRegisterCodes.LeaveUnpaid;
                return new DayComputation(dto, Payable: 0m, Lop: 1m);
            }

            if (holiday is not null)
            {
                dto.Code = AttendanceRegisterCodes.Holiday;
                return new DayComputation(dto, Payable: 1m, Lop: 0m);
            }

            if (isWeekOff)
            {
                dto.Code = AttendanceRegisterCodes.WeekOff;
                return new DayComputation(dto, Payable: 1m, Lop: 0m);
            }

            if (date > today)
            {
                dto.Code = AttendanceRegisterCodes.Dash;
                dto.Flags.Add(AttendanceRegisterFlags.Future);
                return DayComputation.Dash(dto);
            }

            if (date == today)
            {
                dto.Code = AttendanceRegisterCodes.Pending;
                dto.IsPending = true;
                return DayComputation.Pending(dto);
            }

            if (shifts.Count > 0 && attendance.Count == 0)
                dto.Flags.Add(AttendanceRegisterFlags.NoPunch);

            dto.Code = AttendanceRegisterCodes.Absent;
            return new DayComputation(dto, Payable: 0m, Lop: 1m);
        }

        private static string ApplyLeaveOverlay(
            AttendanceRegisterDayDto dto,
            AttendanceRegisterLeaveRow? leave,
            bool attended,
            string code)
        {
            if (leave is null)
                return code;

            dto.Flags.Add(AttendanceRegisterFlags.WorkedOnLeave);
            dto.Flags.Add(leave.IsPaid
                ? AttendanceRegisterFlags.PaidLeave
                : AttendanceRegisterFlags.UnpaidLeave);
            if (leave.HalfDay)
                dto.Flags.Add(AttendanceRegisterFlags.HalfDayLeave);

            if (leave.HalfDay && !leave.IsPaid && attended)
                return AttendanceRegisterCodes.HalfDay;

            return code;
        }

        private static DayComputation BuildWorkedComputation(
            AttendanceRegisterDayDto dto,
            AttendanceRegisterLeaveRow? leave,
            AttendanceRegisterSettingsDto settings,
            bool attended)
        {
            if (dto.Code == AttendanceRegisterCodes.HalfDay)
            {
                var lop = leave is { HalfDay: true, IsPaid: false }
                    ? 0.5m
                    : settings.HalfDayLopEnabled ? 0.5m : 0m;
                return new DayComputation(dto, Payable: 1m - lop, Lop: lop, HalfDayLop: lop);
            }

            if (dto.Code is AttendanceRegisterCodes.Present or AttendanceRegisterCodes.Late)
                return new DayComputation(dto, Payable: 1m, Lop: 0m);

            return new DayComputation(dto, Payable: 1m, Lop: 0m);
        }

        private static List<AttendanceRegisterSegmentDto> BuildSegments(
            List<AttendanceRegisterShiftRow> shifts,
            List<AttendanceRegisterAttendanceRow> attendance)
        {
            var segments = new List<AttendanceRegisterSegmentDto>();
            var usedAttendance = new HashSet<int>();

            foreach (var shift in shifts)
            {
                var matches = attendance
                    .Where(x => x.ShiftAssignmentId == shift.AssignmentId)
                    .ToList();

                if (matches.Count == 0 && shifts.Count == 1)
                {
                    matches = attendance.Where(x => x.ShiftAssignmentId is null).ToList();
                }

                if (matches.Count == 0)
                {
                    segments.Add(new AttendanceRegisterSegmentDto
                    {
                        ShiftAssignmentId = shift.AssignmentId,
                        ShiftId = shift.ShiftId,
                        ShiftName = shift.ShiftName,
                        ShiftStart = shift.ShiftStart,
                        ShiftEnd = shift.ShiftEnd,
                        CrossesMidnight = shift.CrossesMidnight,
                        Status = string.Empty,
                        Source = string.Empty
                    });
                    continue;
                }

                foreach (var match in matches)
                {
                    usedAttendance.Add(match.Id);
                    segments.Add(ToSegment(shift, match));
                }
            }

            foreach (var match in attendance.Where(x => !usedAttendance.Contains(x.Id)))
                segments.Add(ToSegment(null, match));

            return segments
                .OrderBy(x => x.ShiftStart ?? DateTime.MinValue)
                .ThenBy(x => x.CheckInTime ?? DateTime.MinValue)
                .ToList();
        }

        private static AttendanceRegisterSegmentDto ToSegment(
            AttendanceRegisterShiftRow? shift,
            AttendanceRegisterAttendanceRow attendance)
        {
            return new AttendanceRegisterSegmentDto
            {
                AttendanceId = attendance.Id,
                ShiftAssignmentId = shift?.AssignmentId ?? attendance.ShiftAssignmentId,
                ShiftId = shift?.ShiftId,
                ShiftName = shift?.ShiftName,
                ShiftStart = shift?.ShiftStart,
                ShiftEnd = shift?.ShiftEnd,
                CrossesMidnight = shift?.CrossesMidnight ?? false,
                CheckInTime = attendance.CheckInTime,
                CheckOutTime = attendance.CheckOutTime,
                WorkingHours = attendance.WorkingHours,
                Status = attendance.Status,
                IsLate = attendance.IsLate,
                Source = attendance.Source,
                CheckInLocationName = attendance.CheckInLocationName,
                CheckOutLocationName = attendance.CheckOutLocationName,
                MissingCheckout = attendance.MissingPunchDetectedAt.HasValue
            };
        }

        private static string? ToDisplayCode(string status)
        {
            return status switch
            {
                "Present" or "MissingPunch" => AttendanceRegisterCodes.Present,
                "Late" => AttendanceRegisterCodes.Late,
                "Half-day" => AttendanceRegisterCodes.HalfDay,
                "Absent" => AttendanceRegisterCodes.Absent,
                "Leave" => AttendanceRegisterCodes.LeavePaid,
                "Holiday" => AttendanceRegisterCodes.Holiday,
                _ => null
            };
        }

        private static bool IsWorkedStatus(string status) =>
            status is "Present" or "Late" or "Half-day" or "MissingPunch";

        private static Dictionary<(int EmployeeId, DateTime Date), AttendanceRegisterLeaveRow> BuildLeaveMap(
            List<AttendanceRegisterLeaveRow> leaves,
            DateTime monthStart,
            DateTime monthEnd)
        {
            var result = new Dictionary<(int, DateTime), AttendanceRegisterLeaveRow>();

            foreach (var leave in leaves.OrderBy(x => x.Status == "Approved" ? 0 : 1).ThenBy(x => x.Id))
            {
                var from = leave.StartDate.Date < monthStart ? monthStart : leave.StartDate.Date;
                var to = leave.EndDate.Date > monthEnd ? monthEnd : leave.EndDate.Date;
                for (var date = from; date <= to; date = date.AddDays(1))
                {
                    var key = (leave.EmployeeId, date);
                    if (!result.ContainsKey(key))
                        result[key] = leave;
                }
            }

            return result;
        }

        private static void ApplySandwichRule(List<DayComputation> days)
        {
            var index = 0;
            while (index < days.Count)
            {
                if (days[index].Dto.Code is not (AttendanceRegisterCodes.Holiday or AttendanceRegisterCodes.WeekOff))
                {
                    index++;
                    continue;
                }

                var start = index;
                while (index + 1 < days.Count
                       && days[index + 1].Dto.Code is AttendanceRegisterCodes.Holiday or AttendanceRegisterCodes.WeekOff)
                    index++;

                var end = index;
                if (start > 0 && end < days.Count - 1)
                {
                    var before = days[start - 1].Dto.Code;
                    var after = days[end + 1].Dto.Code;
                    if (before is AttendanceRegisterCodes.Absent or AttendanceRegisterCodes.LeaveUnpaid
                        && after is AttendanceRegisterCodes.Absent or AttendanceRegisterCodes.LeaveUnpaid)
                    {
                        for (var i = start; i <= end; i++)
                        {
                            if (!days[i].Dto.Flags.Contains(AttendanceRegisterFlags.SandwichLop))
                                days[i].Dto.Flags.Add(AttendanceRegisterFlags.SandwichLop);
                            days[i] = days[i] with
                            {
                                Payable = 0m,
                                Lop = 1m,
                                SandwichLop = 1m
                            };
                        }
                    }
                }

                index++;
            }
        }

        private static AttendanceRegisterTotalsDto BuildTotals(
            List<DayComputation> days,
            DateTime monthStart)
        {
            var totals = new AttendanceRegisterTotalsDto
            {
                DaysInMonth = DateTime.DaysInMonth(monthStart.Year, monthStart.Month)
            };

            foreach (var day in days)
            {
                switch (day.Dto.Code)
                {
                    case AttendanceRegisterCodes.Present: totals.Present++; break;
                    case AttendanceRegisterCodes.Late: totals.Late++; break;
                    case AttendanceRegisterCodes.HalfDay: totals.HalfDay++; break;
                    case AttendanceRegisterCodes.Absent: totals.Absent++; break;
                    case AttendanceRegisterCodes.LeavePaid: totals.PaidLeave++; break;
                    case AttendanceRegisterCodes.LeaveUnpaid: totals.UnpaidLeave++; break;
                    case AttendanceRegisterCodes.Holiday: totals.Holiday++; break;
                    case AttendanceRegisterCodes.WeekOff: totals.WeekOff++; break;
                    case AttendanceRegisterCodes.Pending: totals.Pending++; break;
                    case AttendanceRegisterCodes.Dash: totals.Dash++; break;
                }

                totals.PayableDays += day.Payable;
                totals.LopDays += day.Lop;
                totals.WorkingHours += day.Dto.WorkingHours;
                totals.HalfDayLopDays += day.HalfDayLop;
                totals.SandwichLopDays += day.SandwichLop;
            }

            totals.PayableDays = Math.Round(totals.PayableDays, 2);
            totals.LopDays = Math.Round(totals.LopDays, 2);
            totals.WorkingHours = Math.Round(totals.WorkingHours, 2);
            return totals;
        }

        private static AttendanceRegisterTotalsDto SumTotals(IEnumerable<AttendanceRegisterRowDto> rows)
        {
            var totals = new AttendanceRegisterTotalsDto();
            foreach (var row in rows)
                totals.Add(row.Totals);
            return totals;
        }

        private async Task<AttendanceRegisterFilterOptionsDto> BuildFilterOptionsAsync()
        {
            return new AttendanceRegisterFilterOptionsDto
            {
                Departments = await _repo.GetDepartmentsAsync(),
                Locations = await _repo.GetLocationsAsync(),
                Shifts = await _repo.GetShiftsAsync()
            };
        }

        private static List<AttendanceRegisterLegendDto> BuildLegend()
        {
            return new List<AttendanceRegisterLegendDto>
            {
                new() { Code = AttendanceRegisterCodes.Present, Label = "Present" },
                new() { Code = AttendanceRegisterCodes.Late, Label = "Late" },
                new() { Code = AttendanceRegisterCodes.HalfDay, Label = "Half day" },
                new() { Code = AttendanceRegisterCodes.Absent, Label = "Absent" },
                new() { Code = AttendanceRegisterCodes.LeavePaid, Label = "Paid leave" },
                new() { Code = AttendanceRegisterCodes.LeaveUnpaid, Label = "Unpaid leave" },
                new() { Code = AttendanceRegisterCodes.Holiday, Label = "Holiday" },
                new() { Code = AttendanceRegisterCodes.WeekOff, Label = "Week off" },
                new() { Code = AttendanceRegisterCodes.Pending, Label = "Pending" },
                new() { Code = AttendanceRegisterCodes.Dash, Label = "Not applicable" }
            };
        }

        private static List<AttendanceRegisterSnapshotRow> BuildSnapshots(
            IReadOnlyList<AttendanceRegisterRowDto> rows)
        {
            return rows.Select(row => new AttendanceRegisterSnapshotRow
            {
                EmployeeId = row.EmployeeId,
                EmployeeCode = row.EmployeeCode,
                EmployeeName = row.EmployeeName,
                DepartmentId = row.DepartmentId,
                DepartmentName = row.DepartmentName,
                LocationId = row.LocationId,
                LocationName = row.LocationName,
                JoiningDate = row.JoiningDate,
                ExitDate = row.ExitDate,
                ShiftIds = row.Days.SelectMany(x => x.ShiftIds).Distinct().ToArray(),
                DaysJson = JsonSerializer.Serialize(row.Days, SnapshotJsonOptions),
                TotalsJson = JsonSerializer.Serialize(row.Totals, SnapshotJsonOptions),
                FlagsJson = JsonSerializer.Serialize(
                    row.Days.SelectMany(x => x.Flags).Distinct().ToList(),
                    SnapshotJsonOptions)
            }).ToList();
        }

        private static AttendanceRegisterSettingsDto DeserializeSettings(
            string? json,
            AttendanceRegisterSettingsDto fallback)
        {
            if (string.IsNullOrWhiteSpace(json))
                return fallback;

            try
            {
                return JsonSerializer.Deserialize<AttendanceRegisterSettingsDto>(
                    json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? fallback;
            }
            catch
            {
                return fallback;
            }
        }

        private static (int Year, int Month) ParseMonth(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                var now = DateTime.Today;
                return (now.Year, now.Month);
            }

            if (!DateTime.TryParseExact(value, "yyyy-MM", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var parsed))
                throw new AttendanceRegisterValidationException("Month must use yyyy-MM format.");

            return (parsed.Year, parsed.Month);
        }

        private sealed record DayComputation(
            AttendanceRegisterDayDto Dto,
            decimal Payable,
            decimal Lop,
            decimal HalfDayLop = 0m,
            decimal SandwichLop = 0m)
        {
            public static DayComputation Dash(AttendanceRegisterDayDto dto) => new(dto, 0m, 0m);
            public static DayComputation Pending(AttendanceRegisterDayDto dto) => new(dto, 0m, 0m);
        }
    }
}
