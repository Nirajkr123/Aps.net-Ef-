namespace ASPCoreWebAPI.Models
{
    public class Designation
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public int DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public string Status { get; set; } = "Active";
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
