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
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationRepository _repository;
        private readonly INotificationService _service;

        public NotificationsController(INotificationRepository repository, INotificationService service)
        {
            _repository = repository;
            _service = service;
        }

        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int limit = 20, [FromQuery] int offset = 0)
        {
            var safeLimit = Math.Clamp(limit, 1, 50);
            var safeOffset = Math.Max(offset, 0);

            var notifications = await _repository.GetByUserIdAsync(CurrentUserId, safeLimit, safeOffset);
            return Ok(notifications);
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _repository.GetUnreadCountAsync(CurrentUserId);
            return Ok(new { count });
        }

        [HttpPut("mark-read")]
        public async Task<IActionResult> MarkRead([FromBody] MarkReadRequest request)
        {
            if (request.Ids.Length == 0) return BadRequest(new { message = "Ids are required." });

            var updated = await _repository.MarkReadAsync(CurrentUserId, request.Ids);
            return Ok(new { updated });
        }

        [HttpPut("mark-all-read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var updated = await _repository.MarkAllReadAsync(CurrentUserId);
            return Ok(new { updated });
        }

        [HttpPost("device-token")]
        public async Task<IActionResult> RegisterDeviceToken([FromBody] RegisterFcmTokenDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Token))
                return BadRequest(new { message = "Token is required." });

            await _repository.SaveFcmTokenAsync(CurrentUserId, dto.Token.Trim(), dto.UserAgent);
            return Ok(new { message = "Device registered" });
        }

        [HttpDelete("device-token")]
        public async Task<IActionResult> UnregisterDeviceToken([FromQuery] string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return BadRequest(new { message = "Token is required." });

            await _repository.RemoveFcmTokenAsync(CurrentUserId, token.Trim());
            return Ok(new { message = "Device removed" });
        }

        [HttpPost("broadcast")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Broadcast([FromBody] BroadcastNotificationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest(new { message = "Title and Message are required." });

            var adminIds = await _repository.GetAdminUserIdsAsync(0);
            var recipients = new List<CreateNotificationDto>();

            if (dto.IncludeAdmins)
            {
                recipients.AddRange(adminIds.Select(id => new CreateNotificationDto
                {
                    UserId = id,
                    Type = dto.Type,
                    Title = dto.Title,
                    Message = dto.Message,
                    Link = dto.Link
                }));
            }

            if (dto.IncludeEmployees)
            {
                var employeeUserIds = await _repository.GetActiveEmployeeUserIdsAsync();
                var adminSet = adminIds.ToHashSet();
                recipients.AddRange(employeeUserIds
                    .Where(id => !adminSet.Contains(id))
                    .Select(id => new CreateNotificationDto
                    {
                        UserId = id,
                        Type = dto.Type,
                        Title = dto.Title,
                        Message = dto.Message,
                        Link = dto.Link
                    }));
            }

            if (recipients.Count == 0)
                return BadRequest(new { message = "No recipients found." });

            await _service.CreateAndPushAsync(recipients);
            return Ok(new { sent = recipients.Count });
        }
    }

    public class BroadcastNotificationDto
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Type { get; set; } = "Announcement";
        public string? Link { get; set; }
        public bool IncludeEmployees { get; set; } = true;
        public bool IncludeAdmins { get; set; } = true;
    }
}
