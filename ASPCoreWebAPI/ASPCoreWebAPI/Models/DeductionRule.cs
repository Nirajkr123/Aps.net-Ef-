namespace ASPCoreWebAPI.Models
{
    public class DeductionRule
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = DeductionTypes.Fixed;
        public decimal Value { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
    }
}
