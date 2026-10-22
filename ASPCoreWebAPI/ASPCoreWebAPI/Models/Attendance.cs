namespace ASPCoreWebAPI.Models
{
    public class Attendance
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public DateTime AttendanceDate { get; set; }
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public decimal? WorkingHours { get; set; }
        public string Status { get; set; } = "Present";
        public bool IsLate { get; set; }
        public string? Location { get; set; }
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Extra fields for admin table view (joined from employees table)
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public string? EmployeeEmail { get; set; }
        public string? Department { get; set; }
    }

    public class AttendanceUpdateDto
    {
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public string? Status { get; set; }
    }

    public class AttendanceFilterDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public string? Department { get; set; }
        public int? EmployeeId { get; set; }
        public string? Status { get; set; }
    }
}
