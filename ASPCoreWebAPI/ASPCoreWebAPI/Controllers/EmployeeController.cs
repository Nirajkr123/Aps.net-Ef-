using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmployeeController : ControllerBase
    {
        private readonly IEmployeeRepository _repository;
        private readonly IDocumentRepository _documentRepository;
        private readonly IUserRepository _userRepository;

        public EmployeeController(IEmployeeRepository repository, IDocumentRepository documentRepository, IUserRepository userRepository)
        {
            _repository = repository;
            _documentRepository = documentRepository;
            _userRepository = userRepository;
        }

        [HttpGet]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? departmentId,
            [FromQuery] int? designationId,
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] bool? profileComplete)
        {
            var employees = await _repository.GetAllAsync(departmentId, designationId, status, search, profileComplete);
            return Ok(employees);
        }

        [HttpGet("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetById(int id)
        {
            var employee = await _repository.GetByIdAsync(id);
            if (employee == null) return NotFound(new { message = "Employee not found" });
            return Ok(employee);
        }

        [HttpGet("stats")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetStats()
        {
            var total = await _repository.CountAsync();
            var incomplete = await _repository.CountIncompleteProfilesAsync();
            return Ok(new { total, incompleteProfiles = incomplete });
        }

        [HttpGet("me")]
        [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
        public async Task<IActionResult> GetMe()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var employee = await _repository.GetByUserIdAsync(userId);
            if (employee == null)
            {
                var code = "EMP" + (await _repository.GetAllAsync()).Count.ToString().PadLeft(4, '0');
                await _repository.CreateAsync(new Models.Employee
                {
                    UserId = userId,
                    EmployeeCode = code,
                    Status = "Active",
                    ProfileComplete = false,
                    CreatedDate = DateTime.UtcNow
                });
                employee = await _repository.GetByUserIdAsync(userId);
            }
            return Ok(employee);
        }

        [HttpPost]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Create([FromBody] Employee employee)
        {
            if (string.IsNullOrWhiteSpace(employee.FirstName))
                return BadRequest(new { message = "First name is required" });

            if (string.IsNullOrWhiteSpace(employee.Email))
                return BadRequest(new { message = "Email is required" });

            var existingUser = await _userRepository.GetByEmailAsync(employee.Email.Trim().ToLower());
            if (existingUser != null)
                return BadRequest(new { message = "A user with this email already exists" });

            var tempPassword = "Employee@123";
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword);

            var user = new User
            {
                FirstName = employee.FirstName,
                LastName = employee.LastName ?? "",
                Email = employee.Email.Trim().ToLower(),
                Password = passwordHash,
                Role = "EMPLOYEE",
                Status = "Active",
                CreatedDate = DateTime.UtcNow
            };
            var userId = await _userRepository.CreateAsync(user);

            employee.UserId = userId;
            employee.EmployeeCode = await _repository.GenerateEmployeeCodeAsync();
            employee.CreatedDate = DateTime.UtcNow;
            employee.Status = "Active";

            var id = await _repository.CreateAsync(employee);
            return Ok(new { message = "Employee created successfully", id, employeeCode = employee.EmployeeCode, tempPassword, userId });
        }

        [HttpPut("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Update(int id, [FromBody] Employee employee)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Employee not found" });

            existing.Phone = employee.Phone ?? existing.Phone;
            existing.Address = employee.Address ?? existing.Address;
            existing.DOB = employee.DOB ?? existing.DOB;
            existing.EmergencyContact = employee.EmergencyContact ?? existing.EmergencyContact;
            existing.DepartmentId = employee.DepartmentId ?? existing.DepartmentId;
            existing.DesignationId = employee.DesignationId ?? existing.DesignationId;
            existing.ManagerId = employee.ManagerId ?? existing.ManagerId;
            existing.EmploymentType = employee.EmploymentType ?? existing.EmploymentType;
            existing.JoiningDate = employee.JoiningDate ?? existing.JoiningDate;
            existing.Status = employee.Status ?? existing.Status;

            await _repository.UpdateAsync(existing);
            return Ok(new { message = "Employee updated successfully" });
        }

        [HttpPut("me/update")]
        [AuthorizeRoles("EMPLOYEE", "OWNER", "HR")]
        public async Task<IActionResult> UpdateMe([FromBody] EmployeeUpdateSelfRequest request)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var employee = await _repository.GetByUserIdAsync(userId);
            if (employee == null)
            {
                var code = "EMP" + (await _repository.GetAllAsync()).Count.ToString().PadLeft(4, '0');
                await _repository.CreateAsync(new Models.Employee
                {
                    UserId = userId,
                    EmployeeCode = code,
                    Status = "Active",
                    ProfileComplete = false,
                    CreatedDate = DateTime.UtcNow
                });
                employee = await _repository.GetByUserIdAsync(userId);
            }

            employee.Phone = request.Phone ?? employee.Phone;
            employee.Address = request.Address ?? employee.Address;
            employee.EmergencyContact = request.EmergencyContact ?? employee.EmergencyContact;
            employee.FatherName = request.FatherName ?? employee.FatherName;
            employee.MotherName = request.MotherName ?? employee.MotherName;
            employee.Gender = request.Gender ?? employee.Gender;
            if (!string.IsNullOrWhiteSpace(request.DOB) && DateTime.TryParse(request.DOB, out var dob))
                employee.DOB = dob;

            if (!string.IsNullOrWhiteSpace(employee.Phone) &&
                !string.IsNullOrWhiteSpace(employee.Address) &&
                !string.IsNullOrWhiteSpace(employee.EmergencyContact))
            {
                employee.ProfileComplete = true;
            }

            await _repository.UpdateProfileFullAsync(employee.Id, employee.Phone ?? "", employee.Address ?? "", employee.EmergencyContact ?? "",
                employee.FatherName, employee.MotherName, employee.Gender, employee.DOB, employee.ProfileComplete);
            return Ok(new { message = "Profile updated successfully" });
        }

        [HttpPatch("{id:int}/deactivate")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Deactivate(int id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Employee not found" });

            await _repository.DeactivateAsync(id);
            return Ok(new { message = "Employee deactivated successfully" });
        }

        [HttpPatch("{id:int}/activate")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Activate(int id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Employee not found" });

            await _repository.ActivateAsync(id);
            return Ok(new { message = "Employee activated successfully" });
        }

        [HttpPut("me/photo")]
        [AuthorizeRoles("EMPLOYEE", "OWNER", "HR")]
        public async Task<IActionResult> UploadPhoto(IFormFile file)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var employee = await _repository.GetByUserIdAsync(userId);
            if (employee == null) return NotFound(new { message = "Employee not found" });

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                return BadRequest(new { message = "Only JPG, PNG, WebP, and GIF images are allowed" });

            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { message = "File size must be less than 5MB" });

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "photos");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var ext = Path.GetExtension(file.FileName);
            var fileName = $"profile_{employee.Id}_{DateTime.UtcNow.Ticks}{ext}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var photoUrl = $"{baseUrl}/uploads/photos/{fileName}";
            await _repository.UpdateProfilePhotoAsync(employee.Id, photoUrl);

            return Ok(new { message = "Profile photo uploaded successfully", profilePhotoUrl = photoUrl });
        }

        [HttpGet("me/photo")]
        [AuthorizeRoles("EMPLOYEE", "OWNER", "HR")]
        public async Task<IActionResult> GetMyPhoto()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var employee = await _repository.GetByUserIdAsync(userId);
            if (employee == null) return NotFound(new { message = "Employee not found" });

            if (string.IsNullOrEmpty(employee.ProfilePhotoUrl))
                return Ok(new { profilePhotoUrl = (string?)null });

            var photoUrl = employee.ProfilePhotoUrl;
            if (photoUrl.StartsWith("/"))
            {
                var baseUrl = $"{Request.Scheme}://{Request.Host}";
                photoUrl = $"{baseUrl}{employee.ProfilePhotoUrl}";
            }

            return Ok(new { profilePhotoUrl = photoUrl });
        }

        [HttpGet("{id:int}/documents")]
        [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
        public async Task<IActionResult> GetDocuments(int id)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role);
            if (userIdClaim == null || roleClaim == null) return Unauthorized();

            var role = roleClaim.Value;
            var userId = int.Parse(userIdClaim.Value);

            if (role == "EMPLOYEE")
            {
                var emp = await _repository.GetByUserIdAsync(userId);
                if (emp == null || emp.Id != id)
                    return Forbid();
            }

            var documents = await _documentRepository.GetByEmployeeIdAsync(id);
            return Ok(documents);
        }
    }

    public class EmployeeUpdateSelfRequest
    {
        public string? Phone { get; set; }
        public string? Address { get; set; }
        public string? EmergencyContact { get; set; }
        public string? FatherName { get; set; }
        public string? MotherName { get; set; }
        public string? Gender { get; set; }
        public string? DOB { get; set; }
    }
}
