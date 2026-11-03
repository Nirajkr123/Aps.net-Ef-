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
        private readonly IWorkLocationRepository _workLocationRepo;
        private readonly ILogger<AttendanceController> _logger;

        public AttendanceController(
            IAttendanceRepository repo,
            INotificationRepository notificationRepo,
            INotificationService notificationService,
            ILeaveService leaveService,
            IWorkLocationRepository workLocationRepo,
            ILogger<AttendanceController> logger)
        {
            _repo = repo;
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

                var result = await _repo.CheckInAsync(
                    employeeId.Value,
                    location!.Latitude!.Value,
                    location.Longitude.Value,
                    location.Accuracy!.Value,
                    workLocation!.Id,
                    distanceMeters,
                    ip);
                await NotifyAttendanceAsync(result, isCheckIn: true);
                return Ok(result);
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
                var result = await _repo.CheckOutAsync(
                    employeeId.Value,
                    location!.Latitude!.Value,
                    location.Longitude.Value,
                    location.Accuracy!.Value,
                    workLocation!.Id,
                    distanceMeters);
                await NotifyAttendanceAsync(result, isCheckIn: false);
                return Ok(result);
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
