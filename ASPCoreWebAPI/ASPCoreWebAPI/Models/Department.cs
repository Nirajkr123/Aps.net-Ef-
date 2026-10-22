namespace ASPCoreWebAPI.Models
{
    public class Department
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = "Active";
        public int EmployeeCount { get; set; }
        public int DesignationCount { get; set; }
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
