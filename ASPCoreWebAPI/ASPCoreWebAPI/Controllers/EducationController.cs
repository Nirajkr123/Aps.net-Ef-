using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EducationController : ControllerBase
    {
        private readonly IEducationRepository _repository;
        private readonly IEmployeeRepository _employeeRepository;

        public EducationController(IEducationRepository repository, IEmployeeRepository employeeRepository)
        {
            _repository = repository;
            _employeeRepository = employeeRepository;
        }

        [HttpGet("employee/{employeeId:int}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> GetByEmployeeId(int employeeId)
        {
            var education = await _repository.GetByEmployeeIdAsync(employeeId);
            return Ok(education);
        }

        [HttpGet("my")]
        [AuthorizeRoles("EMPLOYEE", "OWNER", "HR")]
        public async Task<IActionResult> GetMy()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var employee = await _employeeRepository.GetByUserIdAsync(userId);
            if (employee == null) return Ok(new object[0]);

            var education = await _repository.GetByEmployeeIdAsync(employee.Id);
            return Ok(education);
        }

        [HttpPost]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> Create([FromBody] Education education)
        {
            if (string.IsNullOrWhiteSpace(education.Level))
                return BadRequest(new { message = "Education level is required" });

            education.CreatedDate = DateTime.UtcNow;
            var id = await _repository.CreateAsync(education);
            return Ok(new { message = "Education record added", id });
        }

        [HttpPut("{id:int}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> Update(int id, [FromBody] Education education)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Education record not found" });

            education.Id = id;
            education.EmployeeId = existing.EmployeeId;
            await _repository.UpdateAsync(education);
            return Ok(new { message = "Education updated" });
        }

        [HttpDelete("{id:int}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Education record not found" });

            await _repository.DeleteAsync(id);
            return Ok(new { message = "Education deleted" });
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class EmployeeDocumentController : ControllerBase
    {
        private readonly IEmployeeDocumentRepository _repository;
        private readonly IEmployeeRepository _employeeRepository;

        public EmployeeDocumentController(IEmployeeDocumentRepository repository, IEmployeeRepository employeeRepository)
        {
            _repository = repository;
            _employeeRepository = employeeRepository;
        }

        [HttpGet("employee/{employeeId:int}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> GetByEmployeeId(int employeeId)
        {
            var documents = await _repository.GetByEmployeeIdAsync(employeeId);
            return Ok(documents);
        }

        [HttpGet("my")]
        [AuthorizeRoles("EMPLOYEE", "OWNER", "HR")]
        public async Task<IActionResult> GetMy()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var employee = await _employeeRepository.GetByUserIdAsync(userId);
            if (employee == null) return Ok(new object[0]);

            var documents = await _repository.GetByEmployeeIdAsync(employee.Id);
            return Ok(documents);
        }

        [HttpPost]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> Create([FromBody] EmployeeDocument document)
        {
            if (string.IsNullOrWhiteSpace(document.DocumentType))
                return BadRequest(new { message = "Document type is required" });

            document.CreatedDate = DateTime.UtcNow;
            var id = await _repository.CreateAsync(document);
            return Ok(new { message = "Document record added", id });
        }

        [HttpDelete("{id:int}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Document not found" });

            await _repository.DeleteAsync(id);
            return Ok(new { message = "Document deleted" });
        }
    }
}
