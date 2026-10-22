using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DesignationController : ControllerBase
    {
        private readonly IDesignationRepository _repository;

        public DesignationController(IDesignationRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetAll([FromQuery] int? departmentId)
        {
            var designations = await _repository.GetAllAsync(departmentId);
            return Ok(designations);
        }

        [HttpGet("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetById(int id)
        {
            var designation = await _repository.GetByIdAsync(id);
            if (designation == null) return NotFound(new { message = "Designation not found" });
            return Ok(designation);
        }

        [HttpPost]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Create([FromBody] Designation designation)
        {
            if (string.IsNullOrWhiteSpace(designation.Title))
                return BadRequest(new { message = "Designation title is required" });

            if (designation.DepartmentId <= 0)
                return BadRequest(new { message = "Department is required" });

            if (await _repository.ExistsAsync(designation.Title, designation.DepartmentId))
                return BadRequest(new { message = "Designation already exists in this department" });

            designation.CreatedDate = DateTime.UtcNow;
            designation.Status = "Active";
            var id = await _repository.CreateAsync(designation);
            return Ok(new { message = "Designation created successfully", id });
        }

        [HttpPut("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Update(int id, [FromBody] Designation designation)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Designation not found" });

            if (await _repository.ExistsAsync(designation.Title, designation.DepartmentId, id))
                return BadRequest(new { message = "Designation already exists in this department" });

            existing.Title = designation.Title;
            existing.DepartmentId = designation.DepartmentId;
            existing.Status = designation.Status ?? existing.Status;
            await _repository.UpdateAsync(existing);
            return Ok(new { message = "Designation updated successfully" });
        }

        [HttpDelete("{id:int}")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Designation not found" });

            await _repository.DeleteAsync(id);
            return Ok(new { message = "Designation deleted successfully" });
        }
    }
}
