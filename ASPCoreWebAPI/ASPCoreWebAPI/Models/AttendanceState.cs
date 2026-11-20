namespace ASPCoreWebAPI.Models
{
    public class AttendanceShiftSnapshot
    {
        public int AssignmentId { get; set; }
        public int ShiftId { get; set; }
        public string ShiftName { get; set; } = string.Empty;
        public DateTime ShiftDate { get; set; }
        public DateTime ShiftStartDt { get; set; }
        public DateTime ShiftEndDt { get; set; }
        public bool CrossesMidnight { get; set; }
        public int? EarlyCheckinMinutes { get; set; }
        public int? GraceMinutes { get; set; }
        public int? LateLimitMinutes { get; set; }
        public int? CheckoutBufferMinutes { get; set; }
        public string? PendingRules { get; set; }
        public DateTime? PendingRulesFrom { get; set; }
    }

    public class TodayStateDto
    {
        public DateTimeOffset ServerNow { get; set; }
        public string TimezoneId { get; set; } = "Asia/Kolkata";
        public string EnforcementMode { get; set; } = "WARN";
        public DateOnly AttendanceDate { get; set; }
        public TodayShiftDto? Shift { get; set; }
        public DateTimeOffset? WindowOpensAt { get; set; }
        public DateTimeOffset? WindowClosesAt { get; set; }
        public DateTimeOffset? CheckInDeadlineAt { get; set; }
        public string WindowState { get; set; } = AttendanceWindowStates.NoShift;
        public TodayRulesDto Rules { get; set; } = new();
        public TodayAttendanceDto? Attendance { get; set; }
        public long ElapsedSeconds { get; set; }
        public bool IsWithinWindow { get; set; }
        public bool CanCheckIn { get; set; }
        public bool CanCheckOut { get; set; }
        public List<string> Flags { get; set; } = new();
    }

    public class TodayShiftDto
    {
        public int AssignmentId { get; set; }
        public int ShiftId { get; set; }
        public string ShiftName { get; set; } = string.Empty;
        public DateOnly ShiftDate { get; set; }
        public DateTimeOffset StartAt { get; set; }
        public DateTimeOffset EndAt { get; set; }
        public bool CrossesMidnight { get; set; }
    }

    public class TodayRulesDto
    {
        public int EarlyCheckinMinutes { get; set; }
        public int GraceMinutes { get; set; }
        public int LateLimitMinutes { get; set; }
        public int CheckoutBufferMinutes { get; set; }
        public string Source { get; set; } = "GLOBAL";
    }

    public class TodayAttendanceDto
    {
        public int Id { get; set; }
        public DateTimeOffset? CheckInTime { get; set; }
        public DateTimeOffset? CheckOutTime { get; set; }
        public string Status { get; set; } = "Present";
        public bool IsLate { get; set; }
        public string Source { get; set; } = "SELF";
        public DateTimeOffset? MissingPunchDetectedAt { get; set; }
        public string? Location { get; set; }
        public double? CheckInLatitude { get; set; }
        public double? CheckInLongitude { get; set; }
        public double? CheckOutLatitude { get; set; }
        public double? CheckOutLongitude { get; set; }
        public string? CheckInLocationName { get; set; }
        public string? CheckOutLocationName { get; set; }
    }

    public static class AttendanceWindowStates
    {
        public const string NoShift = "NO_SHIFT";
        public const string BeforeWindow = "BEFORE_WINDOW";
        public const string Open = "OPEN";
        public const string CheckInClosed = "CHECK_IN_CLOSED";
        public const string Closed = "CLOSED";
    }

    public static class AttendanceStateFlags
    {
        public const string NoShift = "NO_SHIFT";
        public const string BeforeWindow = "BEFORE_WINDOW";
        public const string OutsideWindow = "OUTSIDE_WINDOW";
        public const string CheckInClosed = "CHECK_IN_CLOSED";
        public const string WindowClosed = "WINDOW_CLOSED";
        public const string AlreadyCheckedIn = "ALREADY_CHECKED_IN";
        public const string AlreadyCheckedOut = "ALREADY_CHECKED_OUT";
    }
}
