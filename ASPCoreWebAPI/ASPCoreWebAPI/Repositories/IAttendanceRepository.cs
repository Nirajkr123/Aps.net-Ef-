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
            string? ip);

        Task<Attendance> CheckOutAsync(
            int employeeId,
            double latitude,
            double longitude,
            double accuracy,
            int locationId,
            double distanceMeters);
        Task<Attendance?> GetTodayRecordAsync(int employeeId);
        Task<List<Attendance>> GetMyHistoryAsync(int employeeId, DateTime fromDate, DateTime toDate);
        Task<List<Attendance>> GetAllAsync(AttendanceFilterDto filter);
        Task<Attendance?> UpdateAsync(int id, AttendanceUpdateDto dto);
        Task<Attendance?> GetByIdAsync(int id);
    }
}
