namespace ASPCoreWebAPI.Models
{
    public class SalaryStructure
    {
        public long Id { get; set; }
        public int EmployeeId { get; set; }
        public decimal Basic { get; set; }
        public decimal Hra { get; set; }
        public decimal Allowances { get; set; }
        public DateTime EffectiveFrom { get; set; }
        public int? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
