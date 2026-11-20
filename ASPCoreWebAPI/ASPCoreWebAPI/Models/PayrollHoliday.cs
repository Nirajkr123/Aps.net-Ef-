namespace ASPCoreWebAPI.Models
{
    public class PayrollHoliday
    {
        public long Id { get; set; }
        public DateTime HolidayDate { get; set; }
        public string Name { get; set; } = string.Empty;
        public int? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
