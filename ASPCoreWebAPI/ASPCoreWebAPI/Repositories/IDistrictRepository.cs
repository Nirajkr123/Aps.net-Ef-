using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IDistrictRepository
    {
        Task<List<District>> GetAllAsync();
        Task<List<District>> GetByStateAsync(int stateId);
        Task<District?> GetByIdAsync(int id);
        Task<int> CreateAsync(District district);
        Task<bool> UpdateAsync(District district);
        Task<bool> DeleteAsync(int id);
    }
}
