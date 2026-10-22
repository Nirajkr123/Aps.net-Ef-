using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface INotificationRepository
    {
        Task<List<Notification>> GetByUserIdAsync(int userId, int limit, int offset);
        Task<int> GetUnreadCountAsync(int userId);
        Task<int> MarkReadAsync(int userId, int[] ids);
        Task<int> MarkAllReadAsync(int userId);
        Task CreateManyAsync(IEnumerable<CreateNotificationDto> notifications);
        Task<List<int>> GetAdminUserIdsAsync(int excludeUserId);
        Task<List<int>> GetActiveEmployeeUserIdsAsync();
        Task SaveFcmTokenAsync(int userId, string token, string? userAgent);
        Task RemoveFcmTokenAsync(int userId, string token);
        Task RemoveFcmTokensAsync(IEnumerable<string> tokens);
        Task<List<string>> GetFcmTokensByUserIdsAsync(IEnumerable<int> userIds);
    }
}
