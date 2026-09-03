using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IStateRepository
    {
        Task<List<State>> GetAllAsync();
        Task<State?> GetByIdAsync(int id);
        Task<int> CreateAsync(State state);
        Task<bool> UpdateAsync(State state);
        Task<bool> DeleteAsync(int id);
    }
}
