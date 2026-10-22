using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/attendance")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly IAttendanceRepository _repo;
        private readonly INotificationRepository _notificationRepo;
        private readonly INotificationService _notificationService;
        private readonly ILeaveService _leaveService;
        private readonly ILogger<AttendanceController> _logger;

        public AttendanceController(
            IAttendanceRepository repo,
            INotificationRepository notificationRepo,
            INotificationService notificationService,
            ILeaveService leaveService,
            ILogger<AttendanceController> logger)
        {
            _repo = repo;
            _notificationRepo = notificationRepo;
            _notificationService = notificationService;
            _leaveService = leaveService;
            _logger = logger;
        }

        private int? CurrentEmployeeId =>
            int.TryParse(User.FindFirst("employee_id")?.Value, out var employeeId)
                ? employeeId
                : null;

        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpPost("checkin")]
        public async Task<IActionResult> CheckIn()
        {
            var employeeId = CurrentEmployeeId;
            if (employeeId is null)
                return BadRequest(new { message = "No employee profile is linked to your account." });

            /* Approved leave ke din check-in band.

               Ye server par hona zaroori hai: attendance page ka frontend
               guard (`isOnLeave`) sirf UI chhupata hai, aur useEffect/refresh
               ke beech me user check-in kar sakta hai. asli guard yahi hai.

               Server ki date (DateTime.Now) wohi hoti hai jo UI dikhati hai,
               isiliye employee aur uske admin dono ko ek hi din dikhta hai. */
            if (await _leaveService.IsOnLeaveAsync(employeeId.Value, DateTime.Now))
                return BadRequest(new
                {
                    message = "You are on approved leave today, so check-in is not allowed.",
                    code = "on_leave",
                });

            try
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                var result = await _repo.CheckInAsync(employeeId.Value, location: null, ip: ip);
                await NotifyAttendanceAsync(result, isCheckIn: true);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("checkout")]
        public async Task<IActionResult> CheckOut()
        {
            var employeeId = CurrentEmployeeId;
            if (employeeId is null)
                return BadRequest(new { message = "No employee profile is linked to your account." });

            try
            {
                var result = await _repo.CheckOutAsync(employeeId.Value);
                await NotifyAttendanceAsync(result, isCheckIn: false);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private async Task NotifyAttendanceAsync(Attendance record, bool isCheckIn)
        {
            try
            {
                var name = string.IsNullOrWhiteSpace(record.EmployeeName)
                    ? "Unknown employee"
                    : record.EmployeeName.Trim();

                var code = string.IsNullOrWhiteSpace(record.EmployeeCode) ? null : record.EmployeeCode.Trim();
                var department = string.IsNullOrWhiteSpace(record.Department) ? null : record.Department.Trim();

                var label = code is null ? name : $"{name} ({code})";
                var details = department is null ? label : $"{label} - {department}";

                var time = (isCheckIn ? record.CheckInTime : record.CheckOutTime)?.ToString("hh:mm tt")
                           ?? DateTime.Now.ToString("hh:mm tt");

                var selfUserId = CurrentUserId;
                var adminIds = await _notificationRepo.GetAdminUserIdsAsync(selfUserId);

                var action = isCheckIn ? "checked in" : "checked out";
                var titleSelf = isCheckIn ? "Checked In" : "Checked Out";
                var titleAdmin = $"{label} {action}";

                var messageSelf = isCheckIn
                    ? $"You checked in at {time}."
                    : $"You checked out at {time}.";

                var messageAdmin = isCheckIn
                    ? $"{details} checked in at {time}."
                    : $"{details} checked out at {time}.";

                if (!isCheckIn && record.WorkingHours is { } hours)
                {
                    messageAdmin += $" Worked {hours:0.00} hrs.";
                }

                if (isCheckIn && record.IsLate)
                {
                    messageAdmin += " Marked late.";
                }

                var notifications = new List<CreateNotificationDto>
                {
                    new()
                    {
                        UserId = selfUserId,
                        EmployeeId = record.EmployeeId,
                        Type = isCheckIn ? "CheckIn" : "CheckOut",
                        Title = titleSelf,
                        Message = messageSelf,
                        Link = "/attendance"
                    }
                };

                notifications.AddRange(adminIds.Select(adminId => new CreateNotificationDto
                {
                    UserId = adminId,
                    EmployeeId = record.EmployeeId,
                    Type = isCheckIn ? "CheckIn" : "CheckOut",
                    Title = titleAdmin,
                    Message = messageAdmin,
                    Link = "/admin/attendance"
                }));

                await _notificationService.CreateAndPushAsync(notifications);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create attendance notification for record {Id}", record.Id);
            }
        }

        [HttpGet("today")]
        public async Task<IActionResult> GetToday()
        {
            var employeeId = CurrentEmployeeId;
            if (employeeId is null)
                return BadRequest(new { message = "No employee profile is linked to your account." });

            var result = await _repo.GetTodayRecordAsync(employeeId.Value);
            return Ok(result);
        }

        [HttpGet("my-history")]
        public async Task<IActionResult> GetMyHistory([FromQuery] DateTime fromDate, [FromQuery] DateTime toDate)
        {
            var employeeId = CurrentEmployeeId;
            if (employeeId is null)
                return BadRequest(new { message = "No employee profile is linked to your account." });

            var result = await _repo.GetMyHistoryAsync(employeeId.Value, fromDate, toDate);
            return Ok(result);
        }

        [HttpGet("all")]
        [Authorize(Roles = "OWNER,HR")]
        public async Task<IActionResult> GetAll([FromQuery] AttendanceFilterDto filter)
        {
            var result = await _repo.GetAllAsync(filter);
            return Ok(result);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "OWNER,HR")]
        public async Task<IActionResult> Update(int id, [FromBody] AttendanceUpdateDto dto)
        {
            var result = await _repo.UpdateAsync(id, dto);
            if (result == null) return NotFound(new { message = "Attendance record not found" });
            return Ok(result);
        }
    }
}
