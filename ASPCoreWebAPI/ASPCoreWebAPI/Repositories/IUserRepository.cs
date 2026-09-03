using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IUserRepository
    {
        Task<User?> GetByEmailAsync(string email);
        Task<User?> GetByFirebaseUidAsync(string firebaseUid);
        Task<int> CreateAsync(User user);
        Task<User?> GetByIdAsync(int id);
        Task<bool> DeleteAsync(int id);
        Task<bool> UpdateAsync(User user);
        Task<bool> UpdateLastLoginAsync(int id, DateTime lastLogin);
        Task<bool> UpdateStatusAsync(int id, string status);
        Task<bool> UpdateRoleAsync(int id, string role);
        Task<bool> UpdatePasswordAsync(int id, string passwordHash);
        Task<bool> UpdateFirebaseUidAsync(int id, string firebaseUid);

        Task<int> CountTotalAsync();
        Task<int> CountTodayAsync(DateTime start, DateTime end);
        Task<int> CountSinceAsync(DateTime start);
        Task<int> CountRangeAsync(DateTime start, DateTime end);
        Task<List<User>> GetAllAsync();
        Task<List<User>> GetAllManagedAsync();
        Task<Dictionary<string, int>> RoleBreakdownAsync();
    }
}
