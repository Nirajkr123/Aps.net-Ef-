namespace ASPCoreWebAPI.Models
{
    public class PayslipAdjustment
    {
        public long Id { get; set; }
        public long PayslipId { get; set; }
        public string Type { get; set; } = AdjustmentTypes.Other;
        public decimal Amount { get; set; }
        public string? Note { get; set; }
        public int? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
