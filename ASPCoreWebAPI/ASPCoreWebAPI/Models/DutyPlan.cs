namespace ASPCoreWebAPI.Models
{
    public static class DutyPlanModes
    {
        public const string Continuous = "CONTINUOUS";
        public const string Split = "SPLIT";

        public static readonly string[] All = { Continuous, Split };
    }

    public static class DutyPlanStatuses
    {
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string Cancelled = "Cancelled";

        public static readonly string[] All = { Pending, Approved, Rejected, Cancelled };
    }

    public static class DutyPlanAuditActions
    {
        public const string Created = "Created";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string Cancelled = "Cancelled";
        public const string Updated = "Updated";
    }

    public class DutyPlan
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public DateTime DutyDate { get; set; }
        public int LocationId { get; set; }
        public string? LocationName { get; set; }
        public string Mode { get; set; } = DutyPlanModes.Continuous;
        public string Status { get; set; } = DutyPlanStatuses.Pending;
        public DateTime PlannedStartDt { get; set; }
        public DateTime PlannedEndDt { get; set; }
        public decimal TotalHours { get; set; }
        public string? Reason { get; set; }
        public int CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? ApprovedBy { get; set; }
        public string? ApprovedByName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public int? RejectedBy { get; set; }
        public DateTime? RejectedAt { get; set; }
        public int? CancelledBy { get; set; }
        public DateTime? CancelledAt { get; set; }
        public string? DecisionComment { get; set; }
        public List<DutyPlanSegment> Segments { get; set; } = new();
    }

    public class DutyPlanSegment
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public short SeqNo { get; set; }
        public int ShiftId { get; set; }
        public string? ShiftName { get; set; }
        public DateTime PlannedStartDt { get; set; }
        public DateTime PlannedEndDt { get; set; }
        public decimal Hours { get; set; }
    }

    public class DutyPlanAudit
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public string Action { get; set; } = string.Empty;
        public int ActorUserId { get; set; }
        public string? ActorName { get; set; }
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
