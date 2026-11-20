using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IShiftRepository
    {
        Task<List<Shift>> GetAllAsync(bool? isActive = null);
        Task<Shift?> GetByIdAsync(int id);
        Task<bool> NameExistsAsync(string name, int? excludeId = null);
        Task<Shift> CreateAsync(ShiftRequest request);
        Task<Shift?> UpdateAsync(int id, ShiftRequest request);
        Task<Shift?> SetActiveAsync(int id, bool isActive);
        Task<BulkAssignResult> BulkAssignAsync(BulkAssignRequest request, int createdBy);
        Task<BulkAssignPreviewResult> PreviewBulkAssignAsync(BulkAssignRequest request);
        Task<List<AssignmentBatch>> GetBatchesAsync();
        Task<AssignmentBatch?> GetBatchAsync(int batchId);
        Task<List<ShiftAssignment>> GetBatchAssignmentsAsync(int batchId);
        Task<List<ShiftAssignmentLogRow>> GetAssignmentLogAsync();
        Task<bool> RemoveEmployeeFromBatchAsync(int batchId, int empId);
        Task<AssignmentBatch?> CancelBatchAsync(int batchId);
    }
}
