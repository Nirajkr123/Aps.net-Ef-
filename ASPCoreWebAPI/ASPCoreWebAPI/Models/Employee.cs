namespace ASPCoreWebAPI.Models
{
    public class Employee
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public string? EmployeeCode { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Address { get; set; }
        public string? FatherName { get; set; }
        public string? MotherName { get; set; }
        public string? Gender { get; set; }
        public DateTime? DOB { get; set; }
        public string? EmergencyContact { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int? DesignationId { get; set; }
        public string? DesignationTitle { get; set; }
        public int? ManagerId { get; set; }
        public string? ManagerName { get; set; }
        public int? WorkLocationId { get; set; }
        public string? WorkLocationName { get; set; }
        public string? ShiftName { get; set; }
        public string? ShiftTiming { get; set; }
        public string EmploymentType { get; set; } = "FULL_TIME";
        public DateTime? JoiningDate { get; set; }
        public DateTime? ExitDate { get; set; }
        public bool ProfileComplete { get; set; }
        public string? ProfilePhotoUrl { get; set; }
        public string Status { get; set; } = "Active";
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
