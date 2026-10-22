namespace ASPCoreWebAPI.Models
{
    public class Document
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
