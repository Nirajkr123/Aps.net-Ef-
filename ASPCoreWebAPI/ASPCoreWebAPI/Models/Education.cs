namespace ASPCoreWebAPI.Models
{
    public class Education
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string Level { get; set; } = string.Empty;
        public string? Institution { get; set; }
        public string? Board { get; set; }
        public int? YearOfPassing { get; set; }
        public decimal? Percentage { get; set; }
        public decimal? CGPA { get; set; }
        public string? DocumentUrl { get; set; }
        public DateTime CreatedDate { get; set; }
    }

    public class EmployeeDocument
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public string? DocumentName { get; set; }
        public string? DocumentUrl { get; set; }
        public bool IsVerified { get; set; }
        public DateTime CreatedDate { get; set; }
    }
}
