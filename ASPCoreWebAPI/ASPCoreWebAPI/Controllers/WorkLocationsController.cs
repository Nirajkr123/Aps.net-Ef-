using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/work-locations")]
    [Authorize]
    public class WorkLocationsController : ControllerBase
    {
        private readonly IWorkLocationRepository _repo;

        public WorkLocationsController(IWorkLocationRepository repo)
        {
            _repo = repo;
        }

        [HttpGet]
        [Authorize(Roles = "OWNER,HR")]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _repo.GetAllAsync());
        }

        [HttpGet("active")]
        public async Task<IActionResult> GetActive()
        {
            return Ok(await _repo.GetActiveAsync());
        }

        [HttpPost]
        [Authorize(Roles = "OWNER,HR")]
        public async Task<IActionResult> Create([FromBody] WorkLocationRequest? request)
        {
            var error = ValidateRequest(request);
            if (error is not null)
                return BadRequest(new { message = error });

            var result = await _repo.CreateAsync(request!);
            return CreatedAtAction(nameof(GetAll), new { id = result.Id }, result);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "OWNER,HR")]
        public async Task<IActionResult> Update(int id, [FromBody] WorkLocationRequest? request)
        {
            var error = ValidateRequest(request);
            if (error is not null)
                return BadRequest(new { message = error });

            var result = await _repo.UpdateAsync(id, request!);
            if (result is null)
                return NotFound(new { message = "Work location not found." });

            return Ok(result);
        }

        [HttpPatch("{id:int}/active")]
        [Authorize(Roles = "OWNER,HR")]
        public async Task<IActionResult> SetActive(int id, [FromBody] WorkLocationStatusRequest request)
        {
            var result = await _repo.SetActiveAsync(id, request.IsActive);
            if (result is null)
                return NotFound(new { message = "Work location not found." });

            return Ok(result);
        }

        private static string? ValidateRequest(WorkLocationRequest? request)
        {
            if (request is null)
                return "Work location details are required.";

            var name = request.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
                return "Work location name is required.";

            if (name.Length > 150)
                return "Work location name cannot exceed 150 characters.";

            if (request.Latitude is null || request.Latitude < -90 || request.Latitude > 90)
                return "Latitude must be between -90 and 90.";

            if (request.Longitude is null || request.Longitude < -180 || request.Longitude > 180)
                return "Longitude must be between -180 and 180.";

            var radius = request.RadiusMeters ?? 100;
            if (radius < 1 || radius > 10000)
                return "Radius must be between 1 and 10000 meters.";

            return null;
        }
    }
}
