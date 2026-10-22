using System.Text.Json.Serialization;

namespace ASPCoreWebAPI.Models
{
    /* =====================================================================
       Leave — DB entity.
       ---------------------------------------------------------------------
       Ye wahi shape hai jo `Leaves` table me hai (Dapper seedha is class me
       map karta hai), isiliye property names DB column names ke bilkul
       matching hain. Frontend ko ye shape KABHI nahi jaati — uske liye
       `LeaveDto` alag se bana hai (niche dekho).

       Naye columns (`Days`, `ReviewedBy`, `ReviewedOn`, `AdminComment`)
       `scripts/migrate-leave.sql` se aaye the.
       ===================================================================== */
    public class Leave
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string LeaveType { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = LeaveStatuses.Pending;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        /* Apply ke waqt calculate hokar store hota hai. Approve karte waqt
           BALANCE isi number se kat-ta hai, isiliye ye column me rakhna
           zaroori hai — har baar dobara gin-ne ka risk kam karta hai. */
        public int Days { get; set; } = 1;

        /* Review metadata — apply ke time null, decide karne par fill. */
        public string? ReviewedBy { get; set; }
        public DateTime? ReviewedOn { get; set; }
        public string? AdminComment { get; set; }
    }

    /* Status values — DB par bhi CHECK constraint hai (`ck_leaves_status`),
       isiliye ye list aur wo constraint ek saath badalne hain. */
    public static class LeaveStatuses
    {
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string Cancelled = "Cancelled";

        public static readonly string[] All = { Pending, Approved, Rejected, Cancelled };

        /* Admin list ke filter chips sirf ye teen dikhate hain, `Cancelled`
           optional hota hai (user ne khud cancel kiya hua record). */
        public static readonly string[] Reviewable = { Pending, Approved, Rejected };
    }

    /* =====================================================================
       Leave DTO — frontend ka documented contract.
       ---------------------------------------------------------------------
       Frontend `leaveService.js` me jo shape likha hai, wahi yahan hai:
         { id, employeeId, employeeName, type, from, to, days, reason,
           status, appliedOn, reviewedBy, reviewedOn, adminComment }

       Do jaan-booj kar ki gayi baatein:

       1) `from`/`to` STRING hain ('YYYY-MM-dd'), DateTime nahi. Agar
          DateTime bhejein to JSON me timezone shift hota hai aur
          `'2026-09-12'` local time par pichle din tak khisak sakta hai.
          Date-only string se ye problem poora hi khatam.

       2) `employeeName` denormalised hai — admin list me search aur avatar
          dono ke liye chahiye, warna har row par alag Users call karna
          padta.
       ===================================================================== */
    public class LeaveDto
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("from")]
        public string From { get; set; } = string.Empty;

        [JsonPropertyName("to")]
        public string To { get; set; } = string.Empty;

        public int Days { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = LeaveStatuses.Pending;
        public DateTime AppliedOn { get; set; }
        public string? ReviewedBy { get; set; }
        public DateTime? ReviewedOn { get; set; }
        public string? AdminComment { get; set; }

        /* Employee ka pehla naam — drawer ke "profile" chip me dikhta hai. */
        public string? EmployeeCode { get; set; }
        public string? DepartmentName { get; set; }
        public string? DesignationTitle { get; set; }
    }

    /* Row-level DB read: `Leaves` ko `Users`/`Employees` se join karke.
       Dapper is class me map karta hai, phir `ToDto()` se frontend shape. */
    public class LeaveRow
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string LeaveType { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = LeaveStatuses.Pending;
        public DateTime CreatedDate { get; set; }
        public int Days { get; set; }
        public string? ReviewedBy { get; set; }
        public DateTime? ReviewedOn { get; set; }
        public string? AdminComment { get; set; }

        /* Joined columns */
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? EmployeeCode { get; set; }
        public string? DepartmentName { get; set; }
        public string? DesignationTitle { get; set; }

        /* Server-side messages me naam chahiye (overlap clash, approve
           refusal) — wahan DTO convert karne ki zaroorat nahi. */
        public string EmployeeName => string.Join(' ', new[] { FirstName, LastName }
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Select(n => n!.Trim()));

        public LeaveDto ToDto() => new()
        {
            Id = Id,
            EmployeeId = EmployeeId,
            EmployeeName = EmployeeName,
            EmployeeCode = EmployeeCode,
            DepartmentName = DepartmentName,
            DesignationTitle = DesignationTitle,
            Type = LeaveType,
            From = StartDate.ToString("yyyy-MM-dd"),
            To = EndDate.ToString("yyyy-MM-dd"),
            Days = Days,
            Reason = Reason,
            Status = Status,
            AppliedOn = CreatedDate,
            ReviewedBy = ReviewedBy,
            ReviewedOn = ReviewedOn,
            AdminComment = AdminComment,
        };
    }

    /* =====================================================================
       Requests
       ===================================================================== */

    /* POST /api/leaves — note ki `employeeId` YAHIAN nahi hai. Wo token se
       nikalti hai; body se lena security hole hota (koi doosre ki behalf par
       apply kar paata). */
    public class LeaveCreateRequest
    {
        public string Type { get; set; } = string.Empty;
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }

    /* PATCH /api/leaves/:id/reject */
    public class LeaveRejectRequest
    {
        public string Comment { get; set; } = string.Empty;
    }

    /* GET /api/leaves ke query filters — sab optional. */
    public class LeaveQuery
    {
        public string? Status { get; set; }
        public string? Search { get; set; }
        public string? Type { get; set; }

        /* Applied-on range (records kab apply hue), leave range nahi. */
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }

        /* Admin drawer me "is employee ki history" ke liye. */
        public int? EmployeeId { get; set; }
    }

    /* =====================================================================
       Operation result
       ---------------------------------------------------------------------
       Service se controller tak sirf `(dto, error)` jaata to dono ke beech
       ka difference (galat input vs. state conflict) kho jaata tha — jaise
       "already approved" record par reject: 400 (galat input) sahi nahi, 409
       (conflict) chahiye. Isiliye error ke saath ek `Kind` bhi jaata hai.
       ===================================================================== */
    public enum LeaveErrorKind
    {
        /* Bad input / rule violation → 400 */
        Validation,

        /* Record hai par ab us state me nahi (already reviewed, cancel ho
           gaya) → 409 */
        Conflict,

        /* Record hi nahi mila → 404 */
        NotFound
    }

    public readonly record struct LeaveResult(LeaveDto? Leave, string? Error, LeaveErrorKind Kind)
    {
        public bool Ok => Leave is not null && Error is null;

        public static LeaveResult Success(LeaveDto leave) => new(leave, null, LeaveErrorKind.Validation);
        public static LeaveResult Invalid(string error) => new(null, error, LeaveErrorKind.Validation);
        public static LeaveResult Conflict(string error) => new(null, error, LeaveErrorKind.Conflict);
        public static LeaveResult Missing(string error) => new(null, error, LeaveErrorKind.NotFound);
    }

    /* =====================================================================
       Balance
       ---------------------------------------------------------------------
       Frontend `{ Casual:{total,used}, Sick:{...}, ... }` chahta hai — yani
       type-ke-naam se keys, list nahi. `Dictionary` se wo shape seedha mil
       jaata hai, isiliye yahan list nahi rakhi.
       ===================================================================== */
    public class LeaveBalanceRow
    {
        public int Total { get; set; }
        public int Used { get; set; }
    }

    public class LeaveBalanceResponse
    {
        public Dictionary<string, LeaveBalanceRow> Balance { get; set; } = new();

        /* Saare types ka total — dashboard ka ek bada number isse banta hai,
           to extra call nahi lagani padti. */
        public int Total { get; set; }
        public int Used { get; set; }
        public int Remaining { get; set; }

        /* Calendar year jiska balance ye hai — saal change par UI ko pata
           chal jaata hai ki numbers reset hone wale hain. */
        public int Year { get; set; }
    }

    /* GET /api/leaves ke saath admin stat cards ke numbers. List aur counts
       ek hi round-trip me, taaki dono ke beech me koi write na ho (warna
       list 5 dikhe aur cards 6). */
    public class LeaveListResponse
    {
        public List<LeaveDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int PendingCount { get; set; }
        public int ApprovedCount { get; set; }
        public int RejectedCount { get; set; }
        public int CancelledCount { get; set; }

        /* Is employee par chal raha hai ya poore org par (admin view). */
        public int? EmployeeId { get; set; }
    }
}
