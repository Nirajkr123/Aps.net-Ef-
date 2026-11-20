namespace ASPCoreWebAPI.Models
{
    /* =====================================================================
       Dashboard summary — employee home screen ka single payload.

       Web aur mobile dono yahi endpoint use karte hain. Widgets list API se
       aati hai, taaki role ke hisaab se frontend sirf loop chala sake aur
       naye widget add karne par client me branching na badhe.
       ===================================================================== */
    public class DashboardSummaryResponse
    {
        public string Role { get; set; } = "EMPLOYEE";
        public string Status { get; set; } = DashboardStatuses.NotCheckedIn;
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public string? LocationName { get; set; }
        public bool IsLate { get; set; }

        public DashboardEmployeeDto? Employee { get; set; }

        public LeaveBalanceResponse Leave { get; set; } = new();

        public int PresentThisMonth { get; set; }
        public double HoursThisWeek { get; set; }

        public List<DashboardDayHoursDto> WeeklyHours { get; set; } = new();

        public List<DashboardTodayItemDto> TodayItems { get; set; } = new();
        public List<string> Widgets { get; set; } = new();
    }

    public static class DashboardStatuses
    {
        public const string OnDuty = "OnDuty";
        public const string CheckedOut = "CheckedOut";
        public const string NotCheckedIn = "NotCheckedIn";
        public const string OnLeave = "OnLeave";
    }

    public class DashboardEmployeeDto
    {
        public int Id { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? EmployeeCode { get; set; }
        public string? DepartmentName { get; set; }
        public string? DesignationTitle { get; set; }
        public string? ManagerName { get; set; }
        public string? ShiftName { get; set; }
        public string? ShiftTiming { get; set; }
        public string? ProfilePhotoUrl { get; set; }
        public bool ProfileComplete { get; set; }
    }

    public class DashboardTodayItemDto
    {
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Subtitle { get; set; }
        public string? Meta { get; set; }
    }

    public class DashboardDayHoursDto
    {
        public string Label { get; set; } = string.Empty;
        public double Hours { get; set; }
        public bool IsToday { get; set; }
    }
}
