using ASPCoreWebAPI.Middleware;
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
        private readonly IAttendanceStateService _attendanceStateService;
        private readonly IAttendancePunchService _attendancePunchService;
        private readonly IAttendanceOverrideService _attendanceOverrideService;
        private readonly IAttendanceConfigRepository _attendanceConfigRepo;
        private readonly IAttendanceTimeZoneResolver _timeZoneResolver;
        private readonly INotificationRepository _notificationRepo;
        private readonly INotificationService _notificationService;
        private readonly ILeaveService _leaveService;
        private readonly IWorkLocationRepository _workLocationRepo;
        private readonly ILogger<AttendanceController> _logger;

        public AttendanceController(
            IAttendanceRepository repo,
            IAttendanceStateService attendanceStateService,
            IAttendancePunchService attendancePunchService,
            IAttendanceOverrideService attendanceOverrideService,
            IAttendanceConfigRepository attendanceConfigRepo,
            IAttendanceTimeZoneResolver timeZoneResolver,
            INotificationRepository notificationRepo,
            INotificationService notificationService,
            ILeaveService leaveService,
            IWorkLocationRepository workLocationRepo,
            ILogger<AttendanceController> logger)
        {
            _repo = repo;
            _attendanceStateService = attendanceStateService;
            _attendancePunchService = attendancePunchService;
            _attendanceOverrideService = attendanceOverrideService;
            _attendanceConfigRepo = attendanceConfigRepo;
            _timeZoneResolver = timeZoneResolver;
            _notificationRepo = notificationRepo;
            _notificationService = notificationService;
            _leaveService = leaveService;
            _workLocationRepo = workLocationRepo;
            _logger = logger;
        }

        private int? CurrentEmployeeId =>
            int.TryParse(User.FindFirst("employee_id")?.Value, out var employeeId)
                ? employeeId
                : null;

        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpGet("config")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetConfig()
        {
            return Ok(await _attendanceConfigRepo.GetAsync());
        }

        [HttpPut("config")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> UpdateConfig(
            [FromBody] AttendanceConfigUpdateRequest request)
        {
            if (request.PunchEarlyMinutes is { } early && (early < 0 || early > 720))
            {
                return BadRequest(new
                {
                    message = "Check-in early window must be between 0 and 720 minutes."
                });
            }

            if (request.LateGraceMinutes is { } grace && (grace < 0 || grace > 720))
            {
                return BadRequest(new
                {
                    message = "Late grace must be between 0 and 720 minutes."
                });
            }

            if (request.CheckoutBufferMinutes is { } buffer && (buffer < 0 || buffer > 1440))
            {
                return BadRequest(new
                {
                    message = "Checkout buffer must be between 0 and 1440 minutes."
                });
            }

            var config = await _attendanceConfigRepo.CreateVersionAsync(
                request,
                CurrentUserId);

            return Ok(config);
        }

        [HttpPost("checkin")]
        public async Task<IActionResult> CheckIn([FromBody] LocationDto? location)
        {
            var employeeId = CurrentEmployeeId;
            if (employeeId is null)
                return BadRequest(new { message = "No employee profile is linked to your account." });

            var locationError = ValidateLocation(location);
            if (locationError is not null)
                return BadRequest(new { message = locationError });

            var (workLocation, distanceMeters, geofenceError) = await ResolveWorkLocationAsync(location!);
            if (geofenceError is not null)
                return BadRequest(new { message = geofenceError });

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

                var result = await _attendancePunchService.CheckInAsync(
                    employeeId.Value,
                    CurrentUserId,
                    new AttendancePunchLocation(
                        location!.Latitude!.Value,
                        location.Longitude.Value,
                        location.Accuracy!.Value,
                        workLocation!.Id,
                        distanceMeters,
                        ip));
                await NotifyAttendanceAsync(result.Attendance, isCheckIn: true);
                return Ok(result.Attendance);
            }
            catch (AttendancePunchException ex)
            {
                return BadRequest(new { message = ex.Message, code = ex.Code });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("checkout")]
        public async Task<IActionResult> CheckOut([FromBody] LocationDto? location)
        {
            var employeeId = CurrentEmployeeId;
            if (employeeId is null)
                return BadRequest(new { message = "No employee profile is linked to your account." });

            var locationError = ValidateLocation(location);
            if (locationError is not null)
                return BadRequest(new { message = locationError });

            var (workLocation, distanceMeters, geofenceError) = await ResolveWorkLocationAsync(location!);
            if (geofenceError is not null)
                return BadRequest(new { message = geofenceError });

            try
            {
                var result = await _attendancePunchService.CheckOutAsync(
                    employeeId.Value,
                    CurrentUserId,
                    new AttendancePunchLocation(
                        location!.Latitude!.Value,
                        location.Longitude.Value,
                        location.Accuracy!.Value,
                        workLocation!.Id,
                        distanceMeters,
                        HttpContext.Connection.RemoteIpAddress?.ToString()));
                await NotifyAttendanceAsync(result.Attendance, isCheckIn: false);
                return Ok(result.Attendance);
            }
            catch (AttendancePunchException ex)
            {
                return BadRequest(new { message = ex.Message, code = ex.Code });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private static string? ValidateLocation(LocationDto? location)
        {
            if (location?.Latitude is null || location.Longitude is null)
                return "Location is required. Please enable location access and try again.";

            if (location.Latitude < -90 || location.Latitude > 90)
                return "Location latitude is invalid.";

            if (location.Longitude < -180 || location.Longitude > 180)
                return "Location longitude is invalid.";

            if (location.Accuracy is null || location.Accuracy < 0)
                return "Location accuracy is invalid.";

            return null;
        }

        private async Task<(WorkLocation? Location, double DistanceMeters, string? Error)> ResolveWorkLocationAsync(
            LocationDto location)
        {
            var locations = await _workLocationRepo.GetActiveAsync();

            if (locations.Count == 0)
                return (null, 0, "No active work location is configured. Please contact your administrator.");

            WorkLocation? nearest = null;
            var nearestDistance = double.MaxValue;

            foreach (var candidate in locations)
            {
                var distance = HaversineMeters(
                    candidate.Latitude,
                    candidate.Longitude,
                    location.Latitude!.Value,
                    location.Longitude!.Value);

                if (distance <= candidate.RadiusMeters && distance < nearestDistance)
                {
                    nearest = candidate;
                    nearestDistance = distance;
                }
            }

            return nearest is null
                ? (null, 0, "You are not within an allowed location range.")
                : (nearest, nearestDistance, null);
        }

        private static double HaversineMeters(
            double latitude1,
            double longitude1,
            double latitude2,
            double longitude2)
        {
            const double earthRadiusMeters = 6_371_000;

            static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

            var lat1 = ToRadians(latitude1);
            var lat2 = ToRadians(latitude2);
            var deltaLat = ToRadians(latitude2 - latitude1);
            var deltaLon = ToRadians(longitude2 - longitude1);

            var a = Math.Sin(deltaLat / 2) * Math.Sin(deltaLat / 2)
                    + Math.Cos(lat1) * Math.Cos(lat2)
                    * Math.Sin(deltaLon / 2) * Math.Sin(deltaLon / 2);

            return 2 * earthRadiusMeters * Math.Asin(Math.Sqrt(Math.Min(1, a)));
        }

        private static string FormatLocalTime(DateTime utc, TimeZoneInfo timeZone)
        {
            var value = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
            return TimeZoneInfo.ConvertTimeFromUtc(value, timeZone).ToString("hh:mm tt");
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

                var config = await _attendanceConfigRepo.GetAsync();
                var timeZone = _timeZoneResolver.Resolve(config.TimezoneId);
                var punchTime = isCheckIn ? record.CheckInTime : record.CheckOutTime;
                var time = FormatLocalTime(punchTime ?? DateTime.UtcNow, timeZone);

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

        [HttpGet("today-state")]
        public async Task<IActionResult> GetTodayState()
        {
            var employeeId = CurrentEmployeeId;
            if (employeeId is null)
                return BadRequest(new { message = "No employee profile is linked to your account." });

            var result = await _attendanceStateService.GetTodayStateAsync(employeeId.Value);
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

        [HttpPut("{id:int}")]
        [HttpPut("{id:int}/override")]
        [Authorize(Roles = "OWNER,HR")]
        public async Task<IActionResult> Override(int id, [FromBody] AttendanceUpdateDto dto)
        {
            try
            {
                var result = await _attendanceOverrideService.OverrideAsync(id, dto, CurrentUserId);
                if (result == null)
                    return NotFound(new { message = "Attendance record not found" });

                return Ok(result);
            }
            catch (AttendanceOverrideException ex)
            {
                return BadRequest(new { message = ex.Message, code = ex.Code });
            }
        }
    }
}
