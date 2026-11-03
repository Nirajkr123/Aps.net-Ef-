using System.Security.Claims;
using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/shift-assignments")]
    [AuthorizeRoles("OWNER", "HR")]
    public class ShiftAssignmentsController : ControllerBase
    {
        private readonly IShiftRepository _repository;

        public ShiftAssignmentsController(IShiftRepository repository)
        {
            _repository = repository;
        }

        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpPost("bulk")]
        public async Task<IActionResult> BulkAssign([FromBody] BulkAssignRequest? request)
        {
            var error = Validate(request);
            if (error != null) return BadRequest(new { message = error });

            try
            {
                var result = await _repository.BulkAssignAsync(request!, CurrentUserId);
                if (result.StrictBlocked)
                {
                    return Conflict(new
                    {
                        message = result.Message,
                        savedCount = result.SavedCount,
                        skippedCount = result.SkippedCount,
                        skipped = result.Skipped
                    });
                }

                return Ok(result);
            }
            catch (ShiftAssignmentConflictException ex)
            {
                return Conflict(new { message = ex.Message, conflicts = ex.Conflicts });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return Conflict(new
                {
                    message = "Some selected employees already have a shift assigned on these dates."
                });
            }
        }

        [HttpPost("bulk/preview")]
        public async Task<IActionResult> PreviewBulkAssign([FromBody] BulkAssignRequest? request)
        {
            var error = Validate(request);
            if (error != null) return BadRequest(new { message = error });

            try
            {
                return Ok(await _repository.PreviewBulkAssignAsync(request!));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("batches")]
        public async Task<IActionResult> GetBatches()
        {
            return Ok(await _repository.GetBatchesAsync());
        }

        [HttpGet("batches/{batchId:int}")]
        public async Task<IActionResult> GetBatch(int batchId)
        {
            var batch = await _repository.GetBatchAsync(batchId);
            if (batch == null) return NotFound(new { message = "Assignment batch not found." });
            return Ok(batch);
        }

        [HttpGet("batches/{batchId:int}/assignments")]
        public async Task<IActionResult> GetBatchAssignments(int batchId)
        {
            var batch = await _repository.GetBatchAsync(batchId);
            if (batch == null) return NotFound(new { message = "Assignment batch not found." });
            return Ok(await _repository.GetBatchAssignmentsAsync(batchId));
        }

        [HttpPatch("batches/{batchId:int}/cancel")]
        public async Task<IActionResult> CancelBatch(int batchId)
        {
            var batch = await _repository.CancelBatchAsync(batchId);
            if (batch == null) return NotFound(new { message = "Assignment batch not found." });
            return Ok(batch);
        }

        private static string? Validate(BulkAssignRequest? request)
        {
            if (request == null)
                return "Assignment details are required.";

            if (request.ShiftId <= 0)
                return "Please select a shift.";

            if (request.EmployeeIds == null || request.EmployeeIds.Count == 0)
                return "Please select at least one employee.";

            if (request.EmployeeIds.Count(id => id > 0) == 0)
                return "Please select at least one valid employee.";

            if (request.FromDate == default)
                return "From date is required.";

            if (request.ToDate == default)
                return "To date is required.";

            if (request.ToDate.Date < request.FromDate.Date)
                return "To date cannot be earlier than from date.";

            if ((request.ToDate.Date - request.FromDate.Date).Days + 1 > 366)
                return "Date range cannot exceed 366 days.";

            return null;
        }
    }
}
