using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IDesignationRepository
    {
        Task<Designation?> GetByIdAsync(int id);
        Task<List<Designation>> GetAllAsync(int? departmentId = null);
        Task<int> CreateAsync(Designation designation);
        Task<bool> UpdateAsync(Designation designation);
        Task<bool> DeleteAsync(int id);
        Task<bool> ExistsAsync(string title, int departmentId, int? excludeId = null);
    }
}
