using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IAttendanceConfigRepository
    {
        Task<AttendanceConfig> GetAsync();
        Task<AttendanceConfig> GetEffectiveAsync(DateTime date);
        Task<AttendanceConfig> CreateVersionAsync(AttendanceConfigUpdateRequest request, int updatedBy);
    }
}
