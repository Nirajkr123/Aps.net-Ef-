using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentController : ControllerBase
    {
        private readonly IDocumentRepository _repository;
        private readonly IEmployeeDocumentRepository _employeeDocRepository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IWebHostEnvironment _env;

        public DocumentController(
            IDocumentRepository repository,
            IEmployeeDocumentRepository employeeDocRepository,
            IEmployeeRepository employeeRepository,
            IWebHostEnvironment env)
        {
            _repository = repository;
            _employeeDocRepository = employeeDocRepository;
            _employeeRepository = employeeRepository;
            _env = env;
        }

        [HttpPost("upload")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromQuery] string documentType, [FromQuery] int employeeId)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            if (string.IsNullOrWhiteSpace(documentType))
                return BadRequest(new { message = "Document type is required" });

            var employee = await _employeeRepository.GetByIdAsync(employeeId);
            if (employee == null) return NotFound(new { message = "Employee not found" });

            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads", "documents");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var uniqueName = $"{DateTime.UtcNow.Ticks}-{Path.GetRandomFileName()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploadsDir, uniqueName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var document = new Document
            {
                EmployeeId = employeeId,
                Type = documentType.ToUpper(),
                FileName = file.FileName,
                FilePath = filePath,
                UploadedAt = DateTime.UtcNow
            };

            var id = await _repository.CreateAsync(document);
            return Ok(new { message = "Document uploaded successfully", id, fileName = file.FileName });
        }

        [HttpGet("employee/{employeeId:int}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> GetByEmployee(int employeeId)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role);
            if (userIdClaim == null || roleClaim == null) return Unauthorized();

            var role = roleClaim.Value;
            var userId = int.Parse(userIdClaim.Value);

            if (role == "EMPLOYEE")
            {
                var emp = await _employeeRepository.GetByUserIdAsync(userId);
                if (emp == null || emp.Id != employeeId)
                    return Forbid();
            }

            var documents = await _repository.GetByEmployeeIdAsync(employeeId);
            return Ok(documents);
        }

        [HttpDelete("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Delete(int id)
        {
            var doc = await _repository.GetByIdAsync(id);
            if (doc == null) return NotFound(new { message = "Document not found" });

            if (System.IO.File.Exists(doc.FilePath))
                System.IO.File.Delete(doc.FilePath);

            await _repository.DeleteAsync(id);
            return Ok(new { message = "Document deleted successfully" });
        }

        [HttpGet("view-by-employee")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> ViewByEmployee([FromQuery] int employeeId, [FromQuery] string documentType)
        {
            var documents = await _repository.GetByEmployeeIdAsync(employeeId);
            var doc = documents.FirstOrDefault(d => d.Type == documentType.ToUpper());
            if (doc == null) return NotFound(new { message = "Document not found" });

            if (!System.IO.File.Exists(doc.FilePath))
                return NotFound(new { message = "File not found on server" });

            var extension = Path.GetExtension(doc.FileName).ToLower();
            var contentType = extension switch
            {
                ".pdf" => "application/pdf",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                _ => "application/octet-stream"
            };

            var stream = new FileStream(doc.FilePath, FileMode.Open, FileAccess.Read);
            return File(stream, contentType, doc.FileName);
        }

        [HttpGet("view/{id:int}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> View(int id)
        {
            var doc = await _repository.GetByIdAsync(id);
            if (doc == null) return NotFound(new { message = "Document not found" });

            if (!System.IO.File.Exists(doc.FilePath))
                return NotFound(new { message = "File not found on server" });

            var extension = Path.GetExtension(doc.FileName).ToLower();
            var contentType = extension switch
            {
                ".pdf" => "application/pdf",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                _ => "application/octet-stream"
            };

            var stream = new FileStream(doc.FilePath, FileMode.Open, FileAccess.Read);
            return File(stream, contentType, doc.FileName);
        }

        [HttpDelete("employee/{employeeId:int}/type/{docType}")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> DeleteByEmployeeAndType(int employeeId, string docType)
        {
            var typeUpper = docType.ToUpper();

            var docs = await _repository.GetByEmployeeIdAsync(employeeId);
            var doc = docs.FirstOrDefault(d => d.Type == typeUpper);

            if (doc != null)
            {
                if (System.IO.File.Exists(doc.FilePath))
                    System.IO.File.Delete(doc.FilePath);

                await _repository.DeleteAsync(doc.Id);
            }

            await _employeeDocRepository.DeleteByEmployeeAndTypeAsync(employeeId, typeUpper);

            return Ok(new { message = "Document deleted successfully" });
        }
    }
}
