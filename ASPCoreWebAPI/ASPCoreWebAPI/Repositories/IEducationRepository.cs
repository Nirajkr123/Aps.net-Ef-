using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IEducationRepository
    {
        Task<List<Education>> GetByEmployeeIdAsync(int employeeId);
        Task<Education?> GetByIdAsync(int id);
        Task<int> CreateAsync(Education education);
        Task<bool> UpdateAsync(Education education);
        Task<bool> DeleteAsync(int id);
    }

    public interface IEmployeeDocumentRepository
    {
        Task<List<EmployeeDocument>> GetByEmployeeIdAsync(int employeeId);
        Task<EmployeeDocument?> GetByIdAsync(int id);
        Task<EmployeeDocument?> GetByEmployeeAndTypeAsync(int employeeId, string documentType);
        Task<int> CreateAsync(EmployeeDocument document);
        Task<bool> DeleteAsync(int id);
        Task<bool> DeleteByEmployeeAndTypeAsync(int employeeId, string documentType);
    }
}
