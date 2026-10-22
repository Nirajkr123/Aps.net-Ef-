using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IDepartmentRepository
    {
        Task<Department?> GetByIdAsync(int id);
        Task<List<Department>> GetAllAsync();
        Task<int> CreateAsync(Department department);
        Task<bool> UpdateAsync(Department department);
        Task<bool> DeleteAsync(int id);
        Task<bool> NameExistsAsync(string name, int? excludeId = null);
        Task<List<Dictionary<string, object>>> GetEmployeesByDeptAsync(int deptId);
    }
}
