namespace ASPCoreWebAPI.Models
{
    public class AssignmentBatch
    {
        public int BatchId { get; set; }
        public int ShiftId { get; set; }
        public string? ShiftName { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public string? WorkDescription { get; set; }
        public int TotalEmployees { get; set; }
        public int AssignmentCount { get; set; }
        public string Status { get; set; } = "Active";
        public int CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ShiftAssignment
    {
        public int Id { get; set; }
        public int? BatchId { get; set; }
        public int EmpId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public int ShiftId { get; set; }
        public string? ShiftName { get; set; }
        public int? PlanId { get; set; }
        public short? SeqNo { get; set; }
        public DateTime ShiftDate { get; set; }
        public DateTime ShiftStartDt { get; set; }
        public DateTime ShiftEndDt { get; set; }
        public string Status { get; set; } = "Assigned";
        public DateTime CreatedAt { get; set; }
    }

    public class BulkAssignRequest
    {
        public int ShiftId { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public List<int> EmployeeIds { get; set; } = new();
        public string? WorkDescription { get; set; }
        public bool Strict { get; set; }
    }

    public class BulkAssignResult
    {
        public int? BatchId { get; set; }
        public int SavedCount { get; set; }
        public int SkippedCount { get; set; }
        public List<SkippedAssignment> Skipped { get; set; } = new();
        public int TotalEmployees { get; set; }
        public int TotalAssignments { get; set; }
        public bool StrictBlocked { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class BulkAssignPreviewResult
    {
        public bool DryRun { get; set; } = true;
        public int TotalCandidates { get; set; }
        public int WouldSaveCount { get; set; }
        public int WouldSaveEmployeeCount { get; set; }
        public int SkippedCount { get; set; }
        public List<SkippedAssignment> Skipped { get; set; } = new();
        public bool StrictWouldBlock { get; set; }
    }

    public class SkippedAssignment
    {
        public int EmpId { get; set; }
        public DateTime Date { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
    }

    public static class ShiftConflictReasons
    {
        public const string Overlap = "Overlap";
        public const string RestGap = "RestGap";
        public const string SameDayGap = "SameDayGap";
        public const string MaxHoursPerDay = "MaxHoursPerDay";
        public const string MaxExtendedPerWeek = "MaxExtendedPerWeek";
    }

    public class ShiftConflict
    {
        public int EmpId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public DateTime ShiftDate { get; set; }
        public string ExistingShift { get; set; } = string.Empty;
    }

    public class ShiftAssignmentConflictException : Exception
    {
        public List<ShiftConflict> Conflicts { get; }

        public ShiftAssignmentConflictException(string message, List<ShiftConflict> conflicts)
            : base(message)
        {
            Conflicts = conflicts;
        }
    }
}
