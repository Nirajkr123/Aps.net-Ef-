namespace ASPCoreWebAPI.Models
{
    public class Payslip
    {
        public long Id { get; set; }
        public long RunId { get; set; }
        public int EmployeeId { get; set; }
        public int Version { get; set; } = 1;
        public decimal Gross { get; set; }
        public decimal LopDays { get; set; }
        public decimal LopAmount { get; set; }
        public decimal Adjustments { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal NetPay { get; set; }

        public string Items { get; set; } = "[]";
        public string Warnings { get; set; } = "[]";
        public string Status { get; set; } = PayslipStatuses.Draft;
        public string? PdfPath { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
