using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/shifts")]
    [Authorize]
    public class ShiftsController : ControllerBase
    {
        private readonly IShiftRepository _repository;

        public ShiftsController(IShiftRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetAll([FromQuery] bool? isActive)
        {
            return Ok(await _repository.GetAllAsync(isActive));
        }

        [HttpGet("active")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetActive()
        {
            return Ok(await _repository.GetAllAsync(true));
        }

        [HttpGet("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetById(int id)
        {
            var shift = await _repository.GetByIdAsync(id);
            if (shift == null) return NotFound(new { message = "Shift not found." });
            return Ok(shift);
        }

        [HttpPost]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Create([FromBody] ShiftRequest? request)
        {
            var error = Validate(request, requireNameAndStart: true);
            if (error != null) return BadRequest(new { message = error });

            try
            {
                var shift = await _repository.CreateAsync(request!);
                return Ok(shift);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Update(int id, [FromBody] ShiftRequest? request)
        {
            var error = Validate(request, requireNameAndStart: false);
            if (error != null) return BadRequest(new { message = error });

            try
            {
                var shift = await _repository.UpdateAsync(id, request!);
                if (shift == null) return NotFound(new { message = "Shift not found." });
                return Ok(shift);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPatch("{id:int}/status")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> SetStatus(int id, [FromBody] ShiftStatusRequest request)
        {
            var shift = await _repository.SetActiveAsync(id, request.IsActive);
            if (shift == null) return NotFound(new { message = "Shift not found." });
            return Ok(shift);
        }

        private static string? Validate(ShiftRequest? request, bool requireNameAndStart)
        {
            if (request == null)
                return "Shift details are required.";

            if (requireNameAndStart && string.IsNullOrWhiteSpace(request.ShiftName))
                return "Shift name is required.";

            if (!string.IsNullOrWhiteSpace(request.ShiftName) && request.ShiftName.Trim().Length > 100)
                return "Shift name cannot exceed 100 characters.";

            if (requireNameAndStart && string.IsNullOrWhiteSpace(request.StartTime))
                return "Start time is required.";

            if (!string.IsNullOrWhiteSpace(request.StartTime) &&
                !ShiftTime.TryParse(request.StartTime, out _))
                return "Start time must be in HH:mm format.";

            if (request.DurationHours.HasValue &&
                (request.DurationHours.Value <= 0 || request.DurationHours.Value >= 24))
                return "Duration must be greater than 0 and less than 24 hours.";

            return null;
        }
    }
}
