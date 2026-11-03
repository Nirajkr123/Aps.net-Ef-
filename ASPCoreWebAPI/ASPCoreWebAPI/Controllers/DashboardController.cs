using System.Globalization;
using System.Security.Claims;
using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    /* =====================================================================
       GET /api/dashboard/summary

       Employee home screen ka ek hi round-trip. Status, leave balance,
       present days, weekly hours aur aaj ke items sab yahin se aate hain.

       Note: data ka source wahi repositories/services hain jo baaki pages
       use karte hain — koi parallel calculation yahan duplicate nahi ki
       gayi, isliye attendance aur leave pages ke numbers match karte hain.
       ===================================================================== */
    [ApiController]
    [Route("api/dashboard")]
    [AuthorizeRoles("EMPLOYEE")]
    public class DashboardController : ControllerBase
    {
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IAttendanceRepository _attendanceRepository;
        private readonly ILeaveService _leaveService;

        public DashboardController(
            IEmployeeRepository employeeRepository,
            IAttendanceRepository attendanceRepository,
            ILeaveService leaveService)
        {
            _employeeRepository = employeeRepository;
            _attendanceRepository = attendanceRepository;
            _leaveService = leaveService;
        }

        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        private async Task<Employee?> GetCurrentEmployeeAsync()
        {
            var employeeIdClaim = User.FindFirst("employee_id")?.Value;

            if (int.TryParse(employeeIdClaim, out var employeeId))
            {
                var byId = await _employeeRepository.GetByIdAsync(employeeId);
                if (byId != null) return byId;
            }

            return await _employeeRepository.GetByUserIdAsync(CurrentUserId);
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var employee = await GetCurrentEmployeeAsync();
            if (employee == null)
            {
                return NotFound(new
                {
                    message = "No employee record is linked to this account yet. Contact HR to complete your profile."
                });
            }

            var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
            var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);
            var today = now.Date;

            var monthStart = new DateTime(today.Year, today.Month, 1);
            var weekStart = today.AddDays(-((int)today.DayOfWeek + 6) % 7);
            var weekEnd = weekStart.AddDays(6);

            var monthRecords = await _attendanceRepository.GetMyHistoryAsync(employee.Id, monthStart, today);
            var weekRecords = await _attendanceRepository.GetMyHistoryAsync(employee.Id, weekStart, weekEnd);
            var todayRecord = await _attendanceRepository.GetTodayRecordAsync(employee.Id);

            var balance = await _leaveService.GetBalanceAsync(employee.Id);
            var leaves = await _leaveService.GetMyLeavesAsync(employee.Id);

            var todayIso = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var approvedToday = leaves.FirstOrDefault(l =>
                string.Equals(l.Status, LeaveStatuses.Approved, StringComparison.OrdinalIgnoreCase) &&
                string.CompareOrdinal(l.From, todayIso) <= 0 &&
                string.CompareOrdinal(l.To, todayIso) >= 0);

            var pendingLeaves = leaves
                .Where(l => string.Equals(l.Status, LeaveStatuses.Pending, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(l => l.AppliedOn)
                .ToList();

            var status = ResolveStatus(todayRecord, approvedToday);

            var presentThisMonth = monthRecords.Count(r =>
                r.CheckInTime != null &&
                !string.Equals(r.Status, "Absent", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(r.Status, "Leave", StringComparison.OrdinalIgnoreCase));

            var hoursThisWeek = weekRecords
                .Where(r => r.CheckInTime != null)
                .Sum(HoursOfWork);

            var weeklyHours = BuildWeeklyHours(weekRecords, weekStart, today);
            var todayItems = BuildTodayItems(todayRecord, pendingLeaves);

            var response = new DashboardSummaryResponse
            {
                Role = User.FindFirst(ClaimTypes.Role)?.Value ?? "EMPLOYEE",
                Status = status,
                CheckInTime = todayRecord?.CheckInTime,
                CheckOutTime = todayRecord?.CheckOutTime,
                LocationName = todayRecord?.CheckInLocationName ?? todayRecord?.Location,
                IsLate = todayRecord?.IsLate ?? false,
                Employee = new DashboardEmployeeDto
                {
                    Id = employee.Id,
                    FirstName = employee.FirstName,
                    LastName = employee.LastName,
                    Email = employee.Email,
                    EmployeeCode = employee.EmployeeCode,
                    DepartmentName = employee.DepartmentName,
                    DesignationTitle = employee.DesignationTitle,
                    ManagerName = employee.ManagerName,
                    ProfilePhotoUrl = employee.ProfilePhotoUrl,
                    ProfileComplete = employee.ProfileComplete,
                },
                Leave = balance,
                PresentThisMonth = presentThisMonth,
                HoursThisWeek = Math.Round(hoursThisWeek, 2),
                WeeklyHours = weeklyHours,
                TodayItems = todayItems,
                Widgets = new List<string> { "headerCard", "stats", "today", "weeklyHours" },
            };

            return Ok(response);
        }

        private static string ResolveStatus(Attendance? record, LeaveDto? approvedToday)
        {
            if (record?.CheckInTime != null && record.CheckOutTime != null)
                return DashboardStatuses.CheckedOut;

            if (record?.CheckInTime != null)
                return DashboardStatuses.OnDuty;

            if (approvedToday != null)
                return DashboardStatuses.OnLeave;

            return DashboardStatuses.NotCheckedIn;
        }

        private static double HoursOfWork(Attendance record)
        {
            if (record.WorkingHours.HasValue)
                return (double)record.WorkingHours.Value;

            if (record.CheckInTime.HasValue && record.CheckOutTime.HasValue)
            {
                var span = record.CheckOutTime.Value - record.CheckInTime.Value;
                return Math.Max(0, span.TotalHours);
            }

            return 0;
        }

        private static List<DashboardDayHoursDto> BuildWeeklyHours(
            List<Attendance> records,
            DateTime weekStart,
            DateTime today)
        {
            var labels = new[] { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };

            return labels.Select((label, index) =>
            {
                var date = weekStart.AddDays(index);
                var record = records.FirstOrDefault(r => r.AttendanceDate.Date == date);
                var hours = record == null || record.CheckInTime == null
                    ? 0
                    : Math.Round(HoursOfWork(record), 2);

                return new DashboardDayHoursDto
                {
                    Label = label,
                    Hours = hours,
                    IsToday = date == today,
                };
            }).ToList();
        }

        private static List<DashboardTodayItemDto> BuildTodayItems(
            Attendance? record,
            List<LeaveDto> pendingLeaves)
        {
            var items = new List<DashboardTodayItemDto>();

            if (record?.CheckInTime != null)
            {
                var time = record.CheckInTime.Value.ToString("hh:mm tt", CultureInfo.InvariantCulture);

                items.Add(new DashboardTodayItemDto
                {
                    Type = "attendance",
                    Title = record.CheckOutTime != null ? "Day completed" : "Checked in",
                    Subtitle = record.CheckOutTime != null
                        ? $"In {time} · Out {record.CheckOutTime.Value.ToString("hh:mm tt", CultureInfo.InvariantCulture)}"
                        : $"Checked in at {time}",
                    Meta = record.IsLate ? "Late" : "On time",
                });
            }

            if (pendingLeaves.Count > 0)
            {
                var leave = pendingLeaves[0];
                items.Add(new DashboardTodayItemDto
                {
                    Type = "leave",
                    Title = "Pending leave request",
                    Subtitle = $"{leave.Type} · {FormatRange(leave.From, leave.To)}",
                    Meta = pendingLeaves.Count > 1 ? $"+{pendingLeaves.Count - 1} more" : "Awaiting approval",
                });
            }

            return items.Take(3).ToList();
        }

        private static string FormatRange(string from, string to)
        {
            var parsedFrom = DateTime.TryParseExact(from, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var f) ? f : (DateTime?)null;
            var parsedTo = DateTime.TryParseExact(to, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) ? t : (DateTime?)null;

            if (parsedFrom == null || parsedTo == null) return $"{from} – {to}";
            if (parsedFrom.Value == parsedTo.Value)
                return parsedFrom.Value.ToString("d MMM", CultureInfo.InvariantCulture);

            return $"{parsedFrom.Value:d MMM} – {parsedTo.Value:d MMM}";
        }
    }
}
