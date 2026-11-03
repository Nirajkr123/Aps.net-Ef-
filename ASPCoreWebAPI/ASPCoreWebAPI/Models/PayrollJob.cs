namespace ASPCoreWebAPI.Models
{
    public class PayrollJob
    {
        public long Id { get; set; }
        public string Type { get; set; } = PayrollJobTypes.CalculateRun;
        public long? RunId { get; set; }
        public long? PayslipId { get; set; }
        public string Status { get; set; } = PayrollJobStatuses.Queued;
        public int Attempts { get; set; }
        public string? Error { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
