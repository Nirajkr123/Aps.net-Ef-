namespace ASPCoreWebAPI.Models
{
    /* DISCLAIMER:
       PF / ESI / Professional Tax / TDS rules state aur salary ke hisaab se
       alag hote hain. Deductions configurable rakhe gaye hain (hardcode
       nahi). Live salary par chalane se pehle CA / payroll expert se
       verify karwana zaroori hai. */
    public class PayrollRun
    {
        public long Id { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public string Status { get; set; } = PayrollRunStatuses.Draft;
        public int? CreatedBy { get; set; }
        public int? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? PublishedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
