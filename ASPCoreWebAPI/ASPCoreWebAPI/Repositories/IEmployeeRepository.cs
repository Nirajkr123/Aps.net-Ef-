using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IEmployeeRepository
    {
        Task<Employee?> GetByIdAsync(int id);
        Task<Employee?> GetByUserIdAsync(int userId);
        Task<List<Employee>> GetAllAsync(int? departmentId = null, int? designationId = null, string? status = null, string? search = null, bool? profileComplete = null);
        Task<int> CreateAsync(Employee employee);
        Task<bool> UpdateAsync(Employee employee);
        Task<bool> UpdateProfileAsync(int id, string phone, string address, string emergencyContact, bool profileComplete);
        Task<bool> UpdateProfileFullAsync(int id, string phone, string address, string emergencyContact,
            string? fatherName, string? motherName, string? gender, DateTime? dob, bool profileComplete);
        Task<bool> DeactivateAsync(int id, DateTime? exitDate);
        Task<bool> ActivateAsync(int id);
        Task<bool> UpdateProfilePhotoAsync(int id, string profilePhotoUrl);
        Task<string> GenerateEmployeeCodeAsync();
        Task<int> CountAsync();
        Task<int> CountIncompleteProfilesAsync();
    }
}
