using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface ILeaveRepository
    {
        /* ---- Reads ---- */

        /* Employee ki apni history (naye applied pehle). */
        Task<List<LeaveRow>> GetByEmployeeIdAsync(int employeeId);

        /* Admin list. `query` ke saare filters optional hain — null fields
           par koi restriction nahi lagti. */
        Task<List<LeaveRow>> GetAllAsync(LeaveQuery query);

        /* Ek record + us employee ki details (details drawer ke liye). */
        Task<LeaveRow?> GetByIdAsync(int id);

        /* Active leave types + paid/unpaid flag. Apply validation aur
           frontend dropdown dono isi se chalte hain. */
        Task<List<LeaveTypeOption>> GetTypesAsync();

        /* ---- Writes ---- */

        /* Naya apply. `Days` aur `CreatedDate` pehle se set hote hain —
           service inhe calculate karta hai, repository sirf insert karta hai. */
        Task<Leave> CreateAsync(Leave leave);

        /* Review + cancel dono is ek call se hote hain. `reviewedBy`,
           `reviewedOn`, `adminComment` sirf decision endpoints me pass hote
           hain; cancel me ye null reh jaate hain.

           IMPORTANT: `WHERE "Status" = 'Pending'` bhi query me hai. Isse
           do admins ek hi request par approve kar dein to doosra update
           0 rows karega aur controller ko pata chal jaayega — double
           approval se balance dobara na kate. */
        Task<bool> UpdatePendingAsync(
            int id,
            string status,
            string? reviewedBy,
            DateTime? reviewedOn,
            string? adminComment);

        /* ---- Balance ---- */

        /* Har type ke APPROVED days ka sum (rows nahi, DAYS — ek 9-din ki
           leave 9 ginti hai, 1 nahi). `year` se filter isiliye hai ki quota
           calendar year wise reset ho. */
        Task<Dictionary<string, decimal>> GetUsedDaysAsync(int employeeId, int year);
    }
}
