using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IAttendanceRepository
    {
        Task<Attendance> CheckInAsync(int employeeId, string? location, string? ip);
        Task<Attendance> CheckOutAsync(int employeeId);
        Task<Attendance?> GetTodayRecordAsync(int employeeId);
        Task<List<Attendance>> GetMyHistoryAsync(int employeeId, DateTime fromDate, DateTime toDate);
        Task<List<Attendance>> GetAllAsync(AttendanceFilterDto filter);
        Task<Attendance?> UpdateAsync(int id, AttendanceUpdateDto dto);
        Task<Attendance?> GetByIdAsync(int id);
    }
}
