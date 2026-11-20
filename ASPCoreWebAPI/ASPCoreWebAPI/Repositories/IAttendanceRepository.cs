using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IAttendanceRepository
    {
        Task<Attendance> CheckInAsync(
            int employeeId,
            double latitude,
            double longitude,
            double accuracy,
            int locationId,
            double distanceMeters,
            string? ip,
            int? shiftAssignmentId,
            DateTime attendanceDate,
            DateTime checkInUtc,
            bool isLate);

        Task<Attendance> CheckOutAsync(
            int employeeId,
            double latitude,
            double longitude,
            double accuracy,
            int locationId,
            double distanceMeters,
            DateTime checkOutUtc,
            decimal workingHours,
            string status);
        Task<Attendance?> GetTodayRecordAsync(int employeeId);
        Task<List<Attendance>> GetMyHistoryAsync(int employeeId, DateTime fromDate, DateTime toDate);
        Task<List<Attendance>> GetAllAsync(AttendanceFilterDto filter);
        Task<Attendance?> OverrideAsync(
            int id,
            int userId,
            string reason,
            DateTime? checkInUtc,
            DateTime? checkOutUtc,
            decimal? workingHours,
            string status,
            bool isLate);
        Task<Attendance?> GetByIdAsync(int id);
    }
}
