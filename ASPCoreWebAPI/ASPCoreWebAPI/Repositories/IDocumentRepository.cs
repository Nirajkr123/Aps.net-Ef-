using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IDocumentRepository
    {
        Task<Document?> GetByIdAsync(int id);
        Task<List<Document>> GetByEmployeeIdAsync(int employeeId);
        Task<int> CreateAsync(Document document);
        Task<bool> DeleteAsync(int id);
    }
}
