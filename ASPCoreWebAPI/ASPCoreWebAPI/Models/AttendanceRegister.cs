using System.Text.Json.Serialization;

namespace ASPCoreWebAPI.Models
{
    public static class AttendanceRegisterCodes
    {
        public const string Dash = "-";
        public const string Present = "P";
        public const string Late = "LT";
        public const string HalfDay = "HD";
        public const string Absent = "A";
        public const string LeavePaid = "L";
        public const string LeaveUnpaid = "UL";
        public const string Holiday = "H";
        public const string WeekOff = "WO";
        public const string Pending = "PENDING";
    }

    public static class AttendanceRegisterFlags
    {
        public const string Late = "LATE";
        public const string MissingCheckout = "MISSING_CHECKOUT";
        public const string OpenShift = "OPEN_SHIFT";
        public const string NoPunch = "NO_PUNCH";
        public const string HalfDayLeave = "HALF_DAY_LEAVE";
        public const string UnpaidLeave = "UNPAID_LEAVE";
        public const string PaidLeave = "PAID_LEAVE";
        public const string WorkedOnLeave = "WORKED_ON_LEAVE";
        public const string WorkedOnOff = "WORKED_ON_OFF";
        public const string MultiShift = "MULTI_SHIFT";
        public const string PartialMultiShift = "PARTIAL_MULTI_SHIFT";
        public const string SandwichLop = "SANDWICH_LOP";
        public const string Future = "FUTURE";
        public const string BeforeJoining = "BEFORE_JOINING";
        public const string AfterExit = "AFTER_EXIT";
        public const string ExitDateEstimated = "EXIT_DATE_ESTIMATED";
        public const string ManualOverride = "MANUAL_OVERRIDE";
        public const string LegacyLeave = "LEGACY_LEAVE";
        public const string StatusConflict = "STATUS_CONFLICT";
    }

    public sealed class RegisterActor
    {
        public int UserId { get; init; }
        public int? EmployeeId { get; init; }
        public string Role { get; init; } = "EMPLOYEE";
        public bool IsOwnerOrHr => string.Equals(Role, "OWNER", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Role, "HR", StringComparison.OrdinalIgnoreCase);
        public bool IsManager { get; init; }
        public HashSet<int> ManagedEmployeeIds { get; init; } = new();
    }

    public sealed class AttendanceRegisterQuery
    {
        public string Month { get; set; } = string.Empty;
        public int? DepartmentId { get; set; }
        public int? LocationId { get; set; }
        public int? ShiftId { get; set; }
        public string? Search { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
    }

    public sealed class AttendanceRegisterMarkRequest
    {
        public int EmployeeId { get; set; }
        public string Date { get; set; } = string.Empty;
        public int? ShiftAssignmentId { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public sealed class AttendanceRegisterLockRequest
    {
        public string Month { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }

    public sealed class AttendanceRegisterSettingsUpdateRequest
    {
        public bool? SandwichRuleEnabled { get; set; }
        public bool? HalfDayLopEnabled { get; set; }
    }

    public sealed class AttendanceRegisterSettingsDto
    {
        public bool SandwichRuleEnabled { get; set; }
        public bool HalfDayLopEnabled { get; set; } = true;
        public string TimezoneId { get; set; } = "Asia/Kolkata";
        public decimal StandardHours { get; set; } = 10m;
    }

    public sealed class AttendanceRegisterFilterOptionsDto
    {
        public List<AttendanceRegisterOptionDto> Departments { get; set; } = new();
        public List<AttendanceRegisterOptionDto> Locations { get; set; } = new();
        public List<AttendanceRegisterOptionDto> Shifts { get; set; } = new();
    }

    public sealed class AttendanceRegisterOptionDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public sealed class AttendanceRegisterLegendDto
    {
        public string Code { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }

    public sealed class AttendanceRegisterResponse
    {
        public string Month { get; set; } = string.Empty;
        public int Year { get; set; }
        public int MonthNumber { get; set; }
        public int DaysInMonth { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }

        public bool Locked { get; set; }
        public long? LockId { get; set; }
        public int? LockVersion { get; set; }
        public DateTime? LockedAt { get; set; }
        public string? LockedBy { get; set; }
        public string? LockReason { get; set; }

        public AttendanceRegisterSettingsDto Settings { get; set; } = new();
        public AttendanceRegisterFilterOptionsDto Filters { get; set; } = new();
        public List<AttendanceRegisterRowDto> Items { get; set; } = new();
        public AttendanceRegisterTotalsDto GrandTotals { get; set; } = new();
        public List<AttendanceRegisterLegendDto> Legend { get; set; } = new();
    }

    public sealed class AttendanceRegisterRowDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = string.Empty;
        public string EmployeeName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int? LocationId { get; set; }
        public string? LocationName { get; set; }
        public int? ManagerId { get; set; }
        public string? ManagerName { get; set; }
        public DateTime? JoiningDate { get; set; }
        public DateTime? ExitDate { get; set; }
        public string? ExitDateSource { get; set; }
        public string Status { get; set; } = string.Empty;
        public List<AttendanceRegisterDayDto> Days { get; set; } = new();
        public AttendanceRegisterTotalsDto Totals { get; set; } = new();
    }

    public sealed class AttendanceRegisterDayDto
    {
        public string Date { get; set; } = string.Empty;
        public string Code { get; set; } = AttendanceRegisterCodes.Dash;
        public string? LeaveType { get; set; }
        public bool? LeaveIsPaid { get; set; }
        public bool HalfDayLeave { get; set; }
        public string? HolidayName { get; set; }
        public bool IsWeekOff { get; set; }
        public bool IsPending { get; set; }
        public bool IsFuture { get; set; }
        public bool IsBeforeJoining { get; set; }
        public bool IsAfterExit { get; set; }
        public bool MultiShift { get; set; }
        public decimal WorkingHours { get; set; }
        public List<string> Flags { get; set; } = new();
        public int? AttendanceId { get; set; }
        public int? LeaveId { get; set; }
        public List<int> ShiftIds { get; set; } = new();
        public bool CanMark { get; set; }
        public bool Locked { get; set; }
        public List<AttendanceRegisterSegmentDto> Segments { get; set; } = new();
        public AttendanceRegisterLeaveDto? Leave { get; set; }
        public AttendanceRegisterHolidayDto? Holiday { get; set; }
    }

    public sealed class AttendanceRegisterCellDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = string.Empty;
        public string EmployeeName { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Code { get; set; } = AttendanceRegisterCodes.Dash;
        public string? LeaveType { get; set; }
        public bool? LeaveIsPaid { get; set; }
        public bool HalfDayLeave { get; set; }
        public string? HolidayName { get; set; }
        public bool IsWeekOff { get; set; }
        public bool IsPending { get; set; }
        public bool IsFuture { get; set; }
        public bool IsBeforeJoining { get; set; }
        public bool IsAfterExit { get; set; }
        public bool MultiShift { get; set; }
        public decimal WorkingHours { get; set; }
        public List<string> Flags { get; set; } = new();
        public int? AttendanceId { get; set; }
        public int? LeaveId { get; set; }
        public List<int> ShiftIds { get; set; } = new();
        public bool CanMark { get; set; }
        public bool Locked { get; set; }
        public List<AttendanceRegisterSegmentDto> Segments { get; set; } = new();
        public AttendanceRegisterLeaveDto? Leave { get; set; }
        public AttendanceRegisterHolidayDto? Holiday { get; set; }
    }

    public sealed class AttendanceRegisterSegmentDto
    {
        public int? AttendanceId { get; set; }
        public int? ShiftAssignmentId { get; set; }
        public int? ShiftId { get; set; }
        public string? ShiftName { get; set; }
        public DateTime? ShiftStart { get; set; }
        public DateTime? ShiftEnd { get; set; }
        public bool CrossesMidnight { get; set; }
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public decimal? WorkingHours { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsLate { get; set; }
        public string Source { get; set; } = string.Empty;
        public string? CheckInLocationName { get; set; }
        public string? CheckOutLocationName { get; set; }
        public bool MissingCheckout { get; set; }
    }

    public sealed class AttendanceRegisterLeaveDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public bool IsPaid { get; set; }
        public bool HalfDay { get; set; }
        public decimal Days { get; set; }
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }

    public sealed class AttendanceRegisterHolidayDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
    }

    public sealed class AttendanceRegisterTotalsDto
    {
        public int DaysInMonth { get; set; }
        public decimal Present { get; set; }
        public decimal Late { get; set; }
        public decimal HalfDay { get; set; }
        public decimal Absent { get; set; }
        public decimal PaidLeave { get; set; }
        public decimal UnpaidLeave { get; set; }
        public decimal Holiday { get; set; }
        public decimal WeekOff { get; set; }
        public decimal Pending { get; set; }
        public decimal Dash { get; set; }
        public decimal LopDays { get; set; }
        public decimal PayableDays { get; set; }
        public decimal WorkingHours { get; set; }
        public decimal SandwichLopDays { get; set; }
        public decimal HalfDayLopDays { get; set; }

        public void Add(AttendanceRegisterTotalsDto other)
        {
            Present += other.Present;
            Late += other.Late;
            HalfDay += other.HalfDay;
            Absent += other.Absent;
            PaidLeave += other.PaidLeave;
            UnpaidLeave += other.UnpaidLeave;
            Holiday += other.Holiday;
            WeekOff += other.WeekOff;
            Pending += other.Pending;
            Dash += other.Dash;
            LopDays += other.LopDays;
            PayableDays += other.PayableDays;
            WorkingHours += other.WorkingHours;
            SandwichLopDays += other.SandwichLopDays;
            HalfDayLopDays += other.HalfDayLopDays;
            DaysInMonth = Math.Max(DaysInMonth, other.DaysInMonth);
        }
    }

    public sealed class AttendanceRegisterLockDto
    {
        public long Id { get; set; }
        public int Year { get; set; }
        public int Month { get; set; }
        public int Version { get; set; }
        public long? PayrollRunId { get; set; }
        public DateTime LockedAt { get; set; }
        public string? LockedBy { get; set; }
        public string? Reason { get; set; }
        public AttendanceRegisterSettingsDto Settings { get; set; } = new();
    }

    public sealed class PayrollRegisterTotalsDto
    {
        public int EmployeeId { get; set; }
        public decimal LopDays { get; set; }
        public decimal PayableDays { get; set; }
        public int DaysInMonth { get; set; }
        public decimal DashDays { get; set; }
        public decimal PendingDays { get; set; }
        public long? LockId { get; set; }
        public int? LockVersion { get; set; }
    }

    public sealed class AttendanceRegisterEmployeeRow
    {
        public int EmployeeId { get; set; }
        public string? EmployeeCode { get; set; }
        public string? EmployeeName { get; set; }
        public string? Email { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int? LocationId { get; set; }
        public string? LocationName { get; set; }
        public int? ManagerId { get; set; }
        public string? ManagerName { get; set; }
        public DateTime? JoiningDate { get; set; }
        public DateTime? ExitDate { get; set; }
        public string? ExitDateSource { get; set; }
        public DateTime? LastAttendanceDate { get; set; }
        public string? Status { get; set; }
    }

    public sealed class AttendanceRegisterShiftRow
    {
        public int AssignmentId { get; set; }
        public int EmployeeId { get; set; }
        public int ShiftId { get; set; }
        public string? ShiftName { get; set; }
        public DateTime ShiftDate { get; set; }
        public DateTime ShiftStart { get; set; }
        public DateTime ShiftEnd { get; set; }
        public bool CrossesMidnight { get; set; }
        public string? Status { get; set; }
    }

    public sealed class AttendanceRegisterAttendanceRow
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public int? ShiftAssignmentId { get; set; }
        public DateTime AttendanceDate { get; set; }
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public decimal? WorkingHours { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsLate { get; set; }
        public DateTime? MissingPunchDetectedAt { get; set; }
        public string Source { get; set; } = "SELF";
        public string? CheckInLocationName { get; set; }
        public string? CheckOutLocationName { get; set; }
        public string? RegisterCode { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public sealed class AttendanceRegisterLeaveRow
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string LeaveType { get; set; } = string.Empty;
        public bool IsPaid { get; set; } = true;
        public bool HalfDay { get; set; }
        public decimal Days { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public sealed class AttendanceRegisterHolidayRow
    {
        public long Id { get; set; }
        public DateTime HolidayDate { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public sealed class AttendanceRegisterLockRow
    {
        public long Id { get; set; }
        public int Year { get; set; }
        public int Month { get; set; }
        public int Version { get; set; }
        public long? PayrollRunId { get; set; }
        public DateTime LockedAt { get; set; }
        public int? LockedByUserId { get; set; }
        public string? LockedByName { get; set; }
        public string? Reason { get; set; }
        public string SettingsJson { get; set; } = "{}";
    }

    public sealed class AttendanceRegisterSnapshotRow
    {
        public int EmployeeId { get; set; }
        public string? EmployeeCode { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int? LocationId { get; set; }
        public string? LocationName { get; set; }
        public DateTime? JoiningDate { get; set; }
        public DateTime? ExitDate { get; set; }
        public int[] ShiftIds { get; set; } = Array.Empty<int>();
        public string DaysJson { get; set; } = "[]";
        public string TotalsJson { get; set; } = "{}";
        public string FlagsJson { get; set; } = "[]";
    }
}
