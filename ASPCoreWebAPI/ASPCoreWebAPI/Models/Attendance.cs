namespace ASPCoreWebAPI.Models
{
    public class Attendance
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public DateTime AttendanceDate { get; set; }
        public int? ShiftAssignmentId { get; set; }
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public decimal? WorkingHours { get; set; }
        public string Status { get; set; } = "Present";
        public bool IsLate { get; set; }
        public string? Location { get; set; }
        public string? IpAddress { get; set; }
        public double? CheckInLatitude { get; set; }
        public double? CheckInLongitude { get; set; }
        public double? CheckInAccuracy { get; set; }
        public double? CheckOutLatitude { get; set; }
        public double? CheckOutLongitude { get; set; }
        public double? CheckOutAccuracy { get; set; }
        public string? CheckInLocationName { get; set; }
        public string? CheckOutLocationName { get; set; }
        public int? CheckInLocationId { get; set; }
        public int? CheckOutLocationId { get; set; }
        public double? CheckInDistanceMeters { get; set; }
        public double? CheckOutDistanceMeters { get; set; }
        public DateTime? MissingPunchDetectedAt { get; set; }
        public string Source { get; set; } = "SELF";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? Warning { get; set; }
        public List<string>? Flags { get; set; }

        // Extra fields for admin table view (joined from employees and shift tables)
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public string? EmployeeEmail { get; set; }
        public string? Department { get; set; }
        public string? ShiftName { get; set; }
        public DateTime? ShiftStartDt { get; set; }
        public DateTime? ShiftEndDt { get; set; }
        public bool? ShiftCrossesMidnight { get; set; }
    }

    public class AttendanceUpdateDto
    {
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public string? Status { get; set; }
        public string? Reason { get; set; }
    }

    public class LocationDto
    {
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public double? Accuracy { get; set; }
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
