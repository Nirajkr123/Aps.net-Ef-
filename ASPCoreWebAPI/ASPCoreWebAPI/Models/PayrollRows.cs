namespace ASPCoreWebAPI.Models
{
    public class PayrollEmployeeRow
    {
        public int EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public DateTime? JoiningDate { get; set; }
        public long? SalaryStructureId { get; set; }
        public decimal? Basic { get; set; }
        public decimal? Hra { get; set; }
        public decimal? Allowances { get; set; }
        public DateTime? EffectiveFrom { get; set; }
    }

    public class PayslipNotificationRow
    {
        public long PayslipId { get; set; }
        public int EmployeeId { get; set; }
        public int? UserId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public int Version { get; set; }
        public string Status { get; set; } = PayslipStatuses.Draft;
        public bool IsLatest { get; set; }
    }

    public class PayrollAdjustmentRow
    {
        public long Id { get; set; }
        public long PayslipId { get; set; }
        public int EmployeeId { get; set; }
        public string Type { get; set; } = AdjustmentTypes.Other;
        public decimal Amount { get; set; }
        public string? Note { get; set; }
        public int? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }

        public PayslipAdjustment ToAdjustment() => new()
        {
            Id = Id,
            PayslipId = PayslipId,
            Type = Type,
            Amount = Amount,
            Note = Note,
            CreatedBy = CreatedBy,
            CreatedAt = CreatedAt
        };
    }
}
