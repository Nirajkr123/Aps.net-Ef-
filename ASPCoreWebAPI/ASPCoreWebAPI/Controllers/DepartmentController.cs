using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DepartmentController : ControllerBase
    {
        private readonly IDepartmentRepository _repository;

        public DepartmentController(IDepartmentRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetAll()
        {
            var departments = await _repository.GetAllAsync();
            return Ok(departments);
        }

        [HttpGet("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetById(int id)
        {
            var department = await _repository.GetByIdAsync(id);
            if (department == null) return NotFound(new { message = "Department not found" });
            return Ok(department);
        }

        [HttpGet("{id:int}/employees")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetEmployees(int id)
        {
            var employees = await _repository.GetEmployeesByDeptAsync(id);
            return Ok(employees);
        }

        [HttpPost]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Create([FromBody] Department department)
        {
            if (string.IsNullOrWhiteSpace(department.Name))
                return BadRequest(new { message = "Department name is required" });

            if (await _repository.NameExistsAsync(department.Name))
                return BadRequest(new { message = "Department name already exists" });

            department.CreatedDate = DateTime.UtcNow;
            department.Status = "Active";
            var id = await _repository.CreateAsync(department);
            return Ok(new { message = "Department created successfully", id });
        }

        [HttpPut("{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Update(int id, [FromBody] Department department)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Department not found" });

            if (await _repository.NameExistsAsync(department.Name, id))
                return BadRequest(new { message = "Department name already exists" });

            existing.Name = department.Name;
            existing.Description = department.Description;
            existing.Status = department.Status ?? existing.Status;
            await _repository.UpdateAsync(existing);
            return Ok(new { message = "Department updated successfully" });
        }

        [HttpDelete("{id:int}")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Department not found" });

            await _repository.DeleteAsync(id);
            return Ok(new { message = "Department deleted successfully" });
        }

        [HttpPatch("{id:int}/toggle-status")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> ToggleStatus(int id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound(new { message = "Department not found" });

            existing.Status = existing.Status == "Active" ? "Inactive" : "Active";
            await _repository.UpdateAsync(existing);
            return Ok(new { message = $"Department {existing.Status.ToLower()}d successfully", status = existing.Status });
        }

        [HttpGet("stats")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetStats()
        {
            var departments = await _repository.GetAllAsync();
            var total = departments.Count;
            var active = departments.Count(d => d.Status == "Active");
            var inactive = departments.Count(d => d.Status == "Inactive");
            var totalEmployees = departments.Sum(d => d.EmployeeCount);
            var avgEmployees = active > 0 ? Math.Round((double)totalEmployees / active, 1) : 0;

            var largest = departments.OrderByDescending(d => d.EmployeeCount).FirstOrDefault();
            var smallest = departments.Where(d => d.EmployeeCount > 0).OrderBy(d => d.EmployeeCount).FirstOrDefault();

            return Ok(new
            {
                total,
                active,
                inactive,
                totalEmployees,
                avgEmployeesPerDept = avgEmployees,
                largestDept = largest != null ? new { largest.Name, largest.EmployeeCount } : null,
                smallestDept = smallest != null ? new { smallest.Name, smallest.EmployeeCount } : null
            });
        }

        [HttpGet("ai-suggestions")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetAiSuggestions()
        {
            var departments = await _repository.GetAllAsync();
            var suggestions = new List<object>();

            var active = departments.Where(d => d.Status == "Active").ToList();
            var totalEmployees = active.Sum(d => d.EmployeeCount);
            var avg = active.Count > 0 ? (double)totalEmployees / active.Count : 0;

            foreach (var dept in active)
            {
                if (dept.EmployeeCount == 0)
                {
                    suggestions.Add(new
                        {
                            type = "warning",
                            department = dept.Name,
                            message = $"\"{dept.Name}\" has 0 employees. Consider removing or merging it.",
                            priority = "medium"
                        });
                }
                else if (dept.EmployeeCount > avg * 1.5)
                {
                    suggestions.Add(new
                        {
                            type = "info",
                            department = dept.Name,
                            message = $"\"{dept.Name}\" is overstaffed ({dept.EmployeeCount} employees, avg is {avg}). Consider redistribution.",
                            priority = "low"
                        });
                }
                else if (dept.EmployeeCount < avg * 0.5 && dept.EmployeeCount > 0)
                {
                    suggestions.Add(new
                        {
                            type = "warning",
                            department = dept.Name,
                            message = $"\"{dept.Name}\" may be understaffed ({dept.EmployeeCount} employees, avg is {avg}).",
                            priority = "high"
                        });
                }
            }

            var noDesignations = active.Where(d => d.DesignationCount == 0).ToList();
            foreach (var dept in noDesignations)
            {
                suggestions.Add(new
                    {
                        type = "warning",
                        department = dept.Name,
                        message = $"\"{dept.Name}\" has no designations defined. Add designations for better org structure.",
                        priority = "medium"
                    });
            }

            if (!suggestions.Any())
            {
                suggestions.Add(new
                    {
                        type = "success",
                        department = (string?)null,
                        message = "All departments look well-balanced! No issues found.",
                        priority = "low"
                    });
            }

            return Ok(new
            {
                summary = $"Analyzed {active.Count} active departments with {totalEmployees} total employees.",
                suggestions
            });
        }
    }
}
