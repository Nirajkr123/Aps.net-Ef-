using System.Globalization;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;

namespace ASPCoreWebAPI.Services
{
    /* =====================================================================
       ILeaveService — leave ke saare business rules.
       ---------------------------------------------------------------------
       Controller ke kaam sirf HTTP shape hona chahiye (claims padho, status
       code do). Saara decision — validation, day-count, balance, overlap,
       status guard — yahan hai, taaki wo test ho sake aur ek jagah rahe.
       ===================================================================== */
    public interface ILeaveService
    {
        Task<LeaveListResponse> GetListAsync(LeaveQuery query, int? employeeId);
        Task<List<LeaveDto>> GetMyLeavesAsync(int employeeId);
        Task<LeaveDto?> GetByIdAsync(int id);
        Task<LeaveBalanceResponse> GetBalanceAsync(int employeeId);
        Task<LeaveResult> ApplyAsync(int employeeId, LeaveCreateRequest request);
        Task<LeaveResult> CancelAsync(int id, int employeeId);
        Task<LeaveResult> ApproveAsync(int id, string reviewerName);
        Task<LeaveResult> RejectAsync(int id, string reviewerName, string? comment);

        /* Attendance page ke liye: is employee ke approved leave ke saare
           din. Server par check-in block karne ke liye beech me se ek
           round-trip. */
        Task<bool> IsOnLeaveAsync(int employeeId, DateTime date);
    }

    public class LeaveService : ILeaveService
    {
        private readonly ILeaveRepository _leaveRepository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly INotificationRepository _notificationRepository;
        private readonly INotificationService _notificationService;

        public LeaveService(
            ILeaveRepository leaveRepository,
            IEmployeeRepository employeeRepository,
            INotificationRepository notificationRepository,
            INotificationService notificationService)
        {
            _leaveRepository = leaveRepository;
            _employeeRepository = employeeRepository;
            _notificationRepository = notificationRepository;
            _notificationService = notificationService;
        }

        private static int CurrentYear => DateTime.UtcNow.Year;

        /* ---------------------------------------------------------------------
           Day count
           ---------------------------------------------------------------------
           SAB din gin-te hain — weekend bhi count hota hai. (Ye decision
           frontend ke `countBusinessDays` se badal kar yahan aur wahan
           dono jagah same rakha gaya hai.)

           12 Sep se 14 Sep = 3 din. Same din = 1. */
        public static int CountDays(DateTime from, DateTime to) =>
            (to.Date - from.Date).Days + 1;

        // =====================================================================
        //  Reads
        // =====================================================================

        public async Task<LeaveListResponse> GetListAsync(LeaveQuery query, int? employeeId)
        {
            /* Employee sirf apni hi list dekh sakta hai. Admin ko sab. */
            var effectiveQuery = new LeaveQuery
            {
                Status = query.Status,
                Search = query.Search,
                Type = query.Type,
                From = query.From,
                To = query.To,
                EmployeeId = employeeId,
            };

            var rows = await _leaveRepository.GetAllAsync(effectiveQuery);
            var items = rows.Select(r => r.ToDto()).ToList();

            /* Counts poore filtered set se nikalte hain, isiliye frontend
               badges aur list hamesha ek doosre se match karte hain. */
            var statuses = items.Select(i => i.Status).ToList();

            return new LeaveListResponse
            {
                Items = items,
                Total = items.Count,
                PendingCount = statuses.Count(s => s == LeaveStatuses.Pending),
                ApprovedCount = statuses.Count(s => s == LeaveStatuses.Approved),
                RejectedCount = statuses.Count(s => s == LeaveStatuses.Rejected),
                CancelledCount = statuses.Count(s => s == LeaveStatuses.Cancelled),
                EmployeeId = employeeId,
            };
        }

        public async Task<List<LeaveDto>> GetMyLeavesAsync(int employeeId)
        {
            var rows = await _leaveRepository.GetByEmployeeIdAsync(employeeId);
            return rows.Select(r => r.ToDto()).ToList();
        }

        public async Task<LeaveDto?> GetByIdAsync(int id)
        {
            var row = await _leaveRepository.GetByIdAsync(id);
            return row?.ToDto();
        }

        public async Task<LeaveBalanceResponse> GetBalanceAsync(int employeeId)
        {
            var year = CurrentYear;
            var used = await _leaveRepository.GetUsedDaysAsync(employeeId, year);

            var balance = new LeaveBalanceResponse { Year = year };

            foreach (var type in LeaveQuota.Types)
            {
                var total = LeaveQuota.TotalOf(type);
                var u = used.TryGetValue(type, out var value) ? value : 0;

                balance.Balance[type] = new LeaveBalanceRow
                {
                    Total = total,
                    Used = Math.Max(0, u),
                };
            }

            balance.Total = balance.Balance.Values.Sum(r => r.Total);
            balance.Used = balance.Balance.Values.Sum(r => r.Used);
            balance.Remaining = Math.Max(0, balance.Total - balance.Used);

            return balance;
        }

        public async Task<bool> IsOnLeaveAsync(int employeeId, DateTime date)
        {
            var rows = await _leaveRepository.GetByEmployeeIdAsync(employeeId);

            return rows.Any(r =>
                r.Status == LeaveStatuses.Approved &&
                r.StartDate.Date <= date.Date &&
                r.EndDate.Date >= date.Date);
        }

        // =====================================================================
        //  Apply
        // =====================================================================

        public async Task<LeaveResult> ApplyAsync(
            int employeeId, LeaveCreateRequest request)
        {
            /* ---- Type ---- */
            var type = (request.Type ?? string.Empty).Trim();
            if (!LeaveQuota.IsValidType(type))
            {
                return LeaveResult.Invalid("Select a valid leave type");
            }

            /* ---- Dates ----
               `DateOnly.TryParseExact` `yyyy-MM-dd` ke saath — do format hi
               maante hain taaki browser ka `MM/DD/YYYY` reject ho jaye. */
            if (!TryParseDate(request.From, out var from))
            {
                return LeaveResult.Invalid("From date is invalid");
            }

            if (!TryParseDate(request.To, out var to))
            {
                return LeaveResult.Invalid("To date is invalid");
            }

            if (to < from)
            {
                return LeaveResult.Invalid("To date must be on or after the from date");
            }

            var today = DateTime.UtcNow.Date;
            if (from < today)
            {
                return LeaveResult.Invalid("From date cannot be in the past");
            }

            if (to < today)
            {
                return LeaveResult.Invalid("To date cannot be in the past");
            }

            var days = CountDays(from, to);
            if (days <= 0)
            {
                return LeaveResult.Invalid("Selected date range has no days");
            }

            /* ---- Reason ---- */
            var reason = (request.Reason ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(reason))
            {
                return LeaveResult.Invalid("Reason is required");
            }

            if (reason.Length < LeaveQuota.ReasonMinLength)
            {
                return LeaveResult.Invalid(
                    $"Reason must be at least {LeaveQuota.ReasonMinLength} characters " +
                    $"({reason.Length}/{LeaveQuota.ReasonMinLength})");
            }

            /* ---- Balance ----
               Apply karte waqt kuch kat-ta nahi — sirf APPROVED days count
               hote hain. Phir bhi check lagta hai taaki user jis din
               12/12 use kar chuka ho, wo oversell na kar sake. */
            var balance = await GetBalanceAsync(employeeId);
            var row = balance.Balance[type];
            var remaining = Math.Max(0, row.Total - row.Used);

            if (days > remaining)
            {
                return LeaveResult.Invalid(
                    $"You have only {remaining} {type} day{(remaining == 1 ? "" : "s")} left " +
                    $"— this request needs {days}");
            }

            /* ---- Overlap ----
               Pending ya Approved ke saath koi range intersect nahi kar
               sakti. Rejected/Cancelled records nahi rok-te (warna user
               dobara same apply hi nahi kar paayega). */
            var mine = await _leaveRepository.GetByEmployeeIdAsync(employeeId);
            var clash = mine.FirstOrDefault(l =>
                (l.Status == LeaveStatuses.Pending || l.Status == LeaveStatuses.Approved) &&
                l.StartDate.Date <= to.Date &&
                l.EndDate.Date >= from.Date);

            if (clash != null)
            {
                return LeaveResult.Invalid(
                    $"These dates clash with your {clash.Status.ToLowerInvariant()} " +
                    $"{clash.LeaveType} leave ({FormatRange(clash.StartDate, clash.EndDate)})");
            }

            /* ---- Save ----
               Status hamesha 'Pending' — client chahe kuch bhi bheje. */
            var leave = await _leaveRepository.CreateAsync(new Leave
            {
                EmployeeId = employeeId,
                LeaveType = type,
                StartDate = from,
                EndDate = to,
                Reason = reason,
                Days = days,
                Status = LeaveStatuses.Pending,
                CreatedDate = DateTime.UtcNow,
            });

            await NotifyAdminsOfNewRequestAsync(leave, employeeId, type, from, to, days);

            var created = await GetByIdAsync(leave.Id);
            if (created is null)
                return LeaveResult.Conflict("Leave was saved but could not be read back. Please reload.");

            return LeaveResult.Success(created);
        }

        // =====================================================================
        //  Cancel  (employee apna Pending record)
        // =====================================================================

        public async Task<LeaveResult> CancelAsync(int id, int employeeId)
        {
            var row = await _leaveRepository.GetByIdAsync(id);
            if (row == null)
            {
                return LeaveResult.Missing("Leave request not found");
            }

            /* Ownership — koi doosre ka record cancel nahi kar sakta. */
            if (row.EmployeeId != employeeId)
            {
                return LeaveResult.Invalid("You can only cancel your own leave requests");
            }

            if (row.Status != LeaveStatuses.Pending)
            {
                return LeaveResult.Conflict(
                    $"Only pending requests can be cancelled — this one is {row.Status.ToLowerInvariant()}");
            }

            var updated = await _leaveRepository.UpdatePendingAsync(
                id, LeaveStatuses.Cancelled, null, null, null);

            if (!updated)
            {
                /* Beech me kisi ne approve kar diya (double-click ya do tabs). */
                return LeaveResult.Conflict("This request is no longer pending");
            }

            /* Cancel par balance nahi chhuta — woh sirf APPROVED par kat-ta hai. */
            return LeaveResult.Success((await GetByIdAsync(id))!);
        }

        // =====================================================================
        //  Approve  (HR / OWNER)
        // =====================================================================

        public async Task<LeaveResult> ApproveAsync(
            int id, string reviewerName)
        {
            var row = await _leaveRepository.GetByIdAsync(id);
            if (row == null)
            {
                return LeaveResult.Missing("Leave request not found");
            }

            if (row.Status != LeaveStatuses.Pending)
            {
                return LeaveResult.Conflict(
                    $"This request is already {row.Status.ToLowerInvariant()}");
            }

            /* ---- Balance dobara check ----
               Apply aur approve ke beech me user ne aur requests approve
               kar liye ho to oversell ho sakta hai. Isiliye yahan dobara. */
            var balance = await GetBalanceAsync(row.EmployeeId);
            var balanceRow = balance.Balance[row.LeaveType];
            var remaining = Math.Max(0, balanceRow.Total - balanceRow.Used);

            if (row.Days > remaining)
            {
                return LeaveResult.Conflict(
                    $"Cannot approve — {row.EmployeeName} has only {remaining} " +
                    $"{row.LeaveType} day{(remaining == 1 ? "" : "s")} left but this request needs {row.Days}");
            }

            /* ---- Update ----
               Status guard query me hai, isliye double-approve me se ek hi
               pass hoga. */
            var updated = await _leaveRepository.UpdatePendingAsync(
                id,
                LeaveStatuses.Approved,
                reviewerName,
                DateTime.UtcNow,
                null);

            if (!updated)
            {
                return LeaveResult.Conflict("This request is no longer pending");
            }

            await NotifyEmployeeOfDecisionAsync(row, LeaveStatuses.Approved, null, reviewerName);

            return LeaveResult.Success((await GetByIdAsync(id))!);
        }

        // =====================================================================
        //  Reject  (HR / OWNER)
        // =====================================================================

        public async Task<LeaveResult> RejectAsync(
            int id, string reviewerName, string? comment)
        {
            var text = (comment ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                return LeaveResult.Invalid("A comment is required when rejecting a request");
            }

            var row = await _leaveRepository.GetByIdAsync(id);
            if (row == null)
            {
                return LeaveResult.Missing("Leave request not found");
            }

            if (row.Status != LeaveStatuses.Pending)
            {
                return LeaveResult.Conflict(
                    $"This request is already {row.Status.ToLowerInvariant()}");
            }

            var updated = await _leaveRepository.UpdatePendingAsync(
                id,
                LeaveStatuses.Rejected,
                reviewerName,
                DateTime.UtcNow,
                text);

            if (!updated)
            {
                return LeaveResult.Conflict("This request is no longer pending");
            }

            /* Reject par balance bilkul nahi chhuta. */
            await NotifyEmployeeOfDecisionAsync(row, LeaveStatuses.Rejected, text, reviewerName);

            return LeaveResult.Success((await GetByIdAsync(id))!);
        }

        // =====================================================================
        //  Notifications
        // =====================================================================

        private async Task NotifyAdminsOfNewRequestAsync(
            Leave leave, int employeeId, string type, DateTime from, DateTime to, int days)
        {
            var employee = await _employeeRepository.GetByIdAsync(employeeId);
            if (employee == null || employee.UserId == null)
            {
                return;
            }

            var employeeName = string.Join(' ', new[] { employee.FirstName, employee.LastName }
                .Where(n => !string.IsNullOrWhiteSpace(n)));

            var adminUserIds = await _notificationRepository.GetAdminUserIdsAsync(0);
            if (adminUserIds.Count == 0)
            {
                return;
            }

            /* Khud ko notify mat karo — HR/OWNER ne khud apply kiya ho to
               usko apna hi request bell me dikhna weird hoga. */
            var recipients = adminUserIds
                .Where(id => id != employee.UserId)
                .Select(id => new CreateNotificationDto
                {
                    UserId = id,
                    EmployeeId = employeeId,
                    Type = "Leave",
                    Title = "New leave request",
                    Message =
                        $"{employeeName} applied for {type} leave " +
                        $"({FormatRange(from, to)}, {days} day{(days == 1 ? "" : "s")}).",
                    Link = "/admin/leaves",
                })
                .ToList();

            if (recipients.Count == 0)
            {
                return;
            }

            await _notificationService.CreateAndPushAsync(recipients);
        }

        private async Task NotifyEmployeeOfDecisionAsync(
            LeaveRow row, string status, string? comment, string reviewerName)
        {
            var employee = await _employeeRepository.GetByIdAsync(row.EmployeeId);
            if (employee == null || employee.UserId == null)
            {
                return;
            }

            var message =
                $"Your {row.LeaveType} leave ({FormatRange(row.StartDate, row.EndDate)}, {row.Days} " +
                $"day{(row.Days == 1 ? "" : "s")}) was {status.ToLowerInvariant()} by {reviewerName}.";

            if (!string.IsNullOrWhiteSpace(comment))
            {
                message += " " + comment;
            }

            await _notificationService.CreateAndPushAsync(new List<CreateNotificationDto>
            {
                new()
                {
                    UserId = employee.UserId.Value,
                    EmployeeId = row.EmployeeId,
                    Type = "Leave",
                    Title = $"Leave {status.ToLowerInvariant()}",
                    Message = message,
                    Link = "/my-leaves",
                },
            });
        }

        // =====================================================================
        //  Helpers
        // =====================================================================

        /* Sirf 'yyyy-MM-dd'. `DateTime.TryParse` bahut lax hai — wo
           '2026-13-45' jaise garbage ko bhi kabhi kabhi parse kar leta hai
           (current culture ke hisaab se). */
        private static bool TryParseDate(string? value, out DateTime date) =>
            DateTime.TryParseExact(
                (value ?? string.Empty).Trim(),
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out date);

        /* Notification ke liye chhota range — "12–14 Sep" ya "28 Sep – 2 Oct". */
        private static string FormatRange(DateTime from, DateTime to)
        {
            if (from.Date == to.Date)
            {
                return from.ToString("d MMM", CultureInfo.InvariantCulture);
            }

            return from.Month == to.Month
                ? $"{from.Day}–{to.ToString("d MMM", CultureInfo.InvariantCulture)}"
                : $"{from.ToString("d MMM", CultureInfo.InvariantCulture)} – " +
                  $"{to.ToString("d MMM", CultureInfo.InvariantCulture)}";
        }
    }
}
