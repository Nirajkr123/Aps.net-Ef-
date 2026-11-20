namespace ASPCoreWebAPI.Models
{
    public static class RegularizationStatuses
    {
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string Cancelled = "Cancelled";

        public static readonly string[] All = { Pending, Approved, Rejected, Cancelled };
    }

    public class AttendanceRegularization
    {
        public int Id { get; set; }
        public int ShiftAssignmentId { get; set; }
        public int EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public DateTime? RequestedCheckInTime { get; set; }
        public DateTime? RequestedCheckOutTime { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = RegularizationStatuses.Pending;
        public int RequestedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? ReviewedBy { get; set; }
        public string? ReviewedByName { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? AdminComment { get; set; }
    }
}
