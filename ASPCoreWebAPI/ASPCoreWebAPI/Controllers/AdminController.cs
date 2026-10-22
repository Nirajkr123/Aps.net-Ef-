using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly IUserRepository _repository;
        private readonly IStateRepository _stateRepository;
        private readonly IDistrictRepository _districtRepository;

        public AdminController(
            IUserRepository repository,
            IStateRepository stateRepository,
            IDistrictRepository districtRepository)
        {
            _repository = repository;
            _stateRepository = stateRepository;
            _districtRepository = districtRepository;
        }

        /* Saare role names jo employee side hain (HR/OWNER admin hain).

           DB me role strings hain — `EMPLOYEE`, `HR`, `OWNER` — isiliye
           yahan role ke hisaab se hi group karte hain. `Admin`/`User`
           jaisa frontend ka purana label nahi maana jaata, warna EMPLOYEE
           wali rows bhi admin group me chala jaati. */
        private static bool IsEmployeeRole(string? role) =>
            string.Equals(role, "EMPLOYEE", StringComparison.OrdinalIgnoreCase);

        // =========================
        // DASHBOARD
        // =========================

        [HttpGet("dashboard")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Dashboard()
        {
            try
            {
                var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
                var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);
                var today = now.Date;
                var startOfWeek = today.AddDays(-6);
                var startOfLastWeek = today.AddDays(-13);
                var endOfLastWeek = today.AddDays(-7);

                var todayStartUtc = TimeZoneInfo.ConvertTimeToUtc(today, istZone);
                var todayEndUtc = TimeZoneInfo.ConvertTimeToUtc(today.AddDays(1), istZone);
                var startOfWeekUtc = TimeZoneInfo.ConvertTimeToUtc(startOfWeek, istZone);
                var startOfLastWeekUtc = TimeZoneInfo.ConvertTimeToUtc(startOfLastWeek, istZone);
                var endOfLastWeekUtc = TimeZoneInfo.ConvertTimeToUtc(endOfLastWeek, istZone);

                var totalUsers = await _repository.CountTotalAsync();
                var signupsToday = await _repository.CountTodayAsync(todayStartUtc, todayEndUtc);
                var signupsThisWeek = await _repository.CountSinceAsync(startOfWeekUtc);
                var signupsLastWeek = await _repository.CountRangeAsync(startOfLastWeekUtc, endOfLastWeekUtc);

                var roleDb = await _repository.RoleBreakdownAsync();
                var roleBreakdown = roleDb
                    .Select(kv => new { role = kv.Key, count = kv.Value })
                    .ToList();

                var all = await _repository.GetAllAsync();

                /* Har user ka local signup date ek baar nikal lete hain.

                   Pehle ye `Count()` ke andar loop me `ConvertTimeFromUtc`
                   kar raha tha — 7 din × har user, yaani DB size badhne par
                   bekaar CPU. Ab ek hi O(n) pass me ban jata hai. */
                var signupDays = all
                    .Select(x => new
                    {
                        day = TimeZoneInfo.ConvertTimeFromUtc(x.CreatedDate, istZone).Date,
                        role = x.Role
                    })
                    .ToList();

                /* Week me jo din nahi bhi aaye, unka hisaab bhi bhejte hain
                   (count = 0). Warna frontend ko 2-3 din ke hi labels milte
                   aur chart par galat spacing aa jaati. */
                var weeklyTrend = Enumerable.Range(0, 7)
                    .Select(i =>
                    {
                        var d = today.AddDays(-(6 - i));
                        return new
                        {
                            date = d,
                            label = d.ToString("ddd", System.Globalization.CultureInfo.InvariantCulture),
                            count = signupDays.Count(x => x.day == d),
                            admin = signupDays.Count(x => x.day == d && !IsEmployeeRole(x.role)),
                            employee = signupDays.Count(x => x.day == d && IsEmployeeRole(x.role))
                        };
                    })
                    .ToList();

                var signupsWeekTotal = weeklyTrend.Sum(x => x.count);

                var users = all
                    .OrderByDescending(x => x.CreatedDate)
                    .Take(5)
                    .Select(x => new
                    {
                        id = x.Id,
                        firstName = x.FirstName,
                        lastName = x.LastName,
                        email = x.Email,
                        createdAt = x.CreatedDate
                    })
                    .ToList();

                return Ok(new
                {
                    totalUsers,
                    signupsToday,
                    signupsThisWeek,
                    signupsLastWeek,
                    signupsWeekTotal,
                    roleBreakdown,
                    weeklyTrend,
                    users
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to load dashboard",
                    error = ex.Message
                });
            }
        }

        // =========================
        // USER MANAGEMENT
        // =========================

        [HttpGet("users")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                var all = await _repository.GetAllManagedAsync();
                var result = all.Select(x => new
                {
                    id = x.Id,
                    firstName = x.FirstName,
                    lastName = x.LastName,
                    name = string.Join(" ", new[] { x.FirstName, x.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                    email = x.Email,
                    role = x.Role,
                    stateId = x.StateId,
                    districtId = x.DistrictId,
                    state = x.StateName,
                    district = x.DistrictName,
                    status = x.Status,
                    lastLogin = x.LastLogin,
                    createdAt = x.CreatedDate
                });
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to load users",
                    error = ex.Message
                });
            }
        }

        [HttpPut("users/{id:int}")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UserUpdateRequest request)
        {
            try
            {
                var user = await _repository.GetByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                user.FirstName = request.FirstName ?? user.FirstName;
                user.LastName = request.LastName ?? user.LastName;
                user.Email = request.Email ?? user.Email;
                user.Role = request.Role ?? user.Role;
                user.StateId = request.StateId;
                user.DistrictId = request.DistrictId;
                user.Status = request.Status ?? user.Status;

                await _repository.UpdateAsync(user);

                return Ok(new { message = "User updated successfully", id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to update user",
                    error = ex.Message
                });
            }
        }

        [HttpPost("users/{id:int}/role")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> ChangeRole(int id, [FromBody] ChangeRoleRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Role))
                {
                    return BadRequest(new { message = "Role is required" });
                }

                var user = await _repository.GetByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                await _repository.UpdateRoleAsync(id, request.Role);
                return Ok(new { message = "Role updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to change role",
                    error = ex.Message
                });
            }
        }

        [HttpPost("users/{id:int}/reset-password")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
                {
                    return BadRequest(new { message = "New password must be at least 8 characters" });
                }

                var user = await _repository.GetByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                var callerRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "";

                if (!string.IsNullOrWhiteSpace(request.CurrentPassword))
                {
                    bool isCurrentValid = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.Password);
                    if (!isCurrentValid)
                    {
                        return BadRequest(new { message = "Current password is incorrect" });
                    }
                }
                else if (callerRole != "OWNER")
                {
                    return StatusCode(403, new { message = "Only admin can reset password without current password" });
                }

                var hash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                await _repository.UpdatePasswordAsync(id, hash);
                return Ok(new { message = "Password reset successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to reset password",
                    error = ex.Message
                });
            }
        }

        [HttpPost("users/{id:int}/activate")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> ActivateUser(int id)
        {
            return await SetUserStatusAsync(id, "Active");
        }

        [HttpPost("users/{id:int}/deactivate")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> DeactivateUser(int id)
        {
            return await SetUserStatusAsync(id, "Inactive");
        }

        private async Task<IActionResult> SetUserStatusAsync(int id, string status)
        {
            try
            {
                var user = await _repository.GetByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                await _repository.UpdateStatusAsync(id, status);
                return Ok(new { message = $"User {status.ToLower()} successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to update user status",
                    error = ex.Message
                });
            }
        }

        [HttpDelete("users/{id:int}")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            try
            {
                var user = await _repository.GetByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                await _repository.DeleteAsync(id);
                return Ok(new { message = "User deleted successfully", id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to delete user",
                    error = ex.Message
                });
            }
        }

        // =========================
        // STATE MANAGEMENT
        // =========================

        [HttpGet("states")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> GetStates()
        {
            try
            {
                var states = await _stateRepository.GetAllAsync();
                return Ok(states);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to load states",
                    error = ex.Message
                });
            }
        }

        [HttpPost("states")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> CreateState([FromBody] State state)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(state.Name))
                {
                    return BadRequest(new { message = "State name is required" });
                }

                var id = await _stateRepository.CreateAsync(state);
                return Ok(new { message = "State created successfully", id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to create state",
                    error = ex.Message
                });
            }
        }

        [HttpPut("states/{id:int}")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> UpdateState(int id, [FromBody] State state)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(state.Name))
                {
                    return BadRequest(new { message = "State name is required" });
                }

                var existing = await _stateRepository.GetByIdAsync(id);
                if (existing == null)
                {
                    return NotFound(new { message = "State not found" });
                }

                state.Id = id;
                await _stateRepository.UpdateAsync(state);
                return Ok(new { message = "State updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to update state",
                    error = ex.Message
                });
            }
        }

        [HttpDelete("states/{id:int}")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> DeleteState(int id)
        {
            try
            {
                var existing = await _stateRepository.GetByIdAsync(id);
                if (existing == null)
                {
                    return NotFound(new { message = "State not found" });
                }

                await _stateRepository.DeleteAsync(id);
                return Ok(new { message = "State deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to delete state",
                    error = ex.Message
                });
            }
        }

        // =========================
        // DISTRICT MANAGEMENT
        // =========================

        [HttpGet("districts")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> GetDistricts([FromQuery] int? stateId)
        {
            try
            {
                var districts = stateId.HasValue
                    ? await _districtRepository.GetByStateAsync(stateId.Value)
                    : await _districtRepository.GetAllAsync();
                return Ok(districts);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to load districts",
                    error = ex.Message
                });
            }
        }

        [HttpPost("districts")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> CreateDistrict([FromBody] District district)
        {
            try
            {
                if (district.StateId <= 0 || string.IsNullOrWhiteSpace(district.Name))
                {
                    return BadRequest(new { message = "State and district name are required" });
                }

                var state = await _stateRepository.GetByIdAsync(district.StateId);
                if (state == null)
                {
                    return NotFound(new { message = "State not found" });
                }

                var id = await _districtRepository.CreateAsync(district);
                return Ok(new { message = "District created successfully", id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to create district",
                    error = ex.Message
                });
            }
        }

        [HttpPut("districts/{id:int}")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> UpdateDistrict(int id, [FromBody] District district)
        {
            try
            {
                if (district.StateId <= 0 || string.IsNullOrWhiteSpace(district.Name))
                {
                    return BadRequest(new { message = "State and district name are required" });
                }

                var existing = await _districtRepository.GetByIdAsync(id);
                if (existing == null)
                {
                    return NotFound(new { message = "District not found" });
                }

                district.Id = id;
                await _districtRepository.UpdateAsync(district);
                return Ok(new { message = "District updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to update district",
                    error = ex.Message
                });
            }
        }

        [HttpDelete("districts/{id:int}")]
        [AuthorizeRoles("OWNER")]
        public async Task<IActionResult> DeleteDistrict(int id)
        {
            try
            {
                var existing = await _districtRepository.GetByIdAsync(id);
                if (existing == null)
                {
                    return NotFound(new { message = "District not found" });
                }

                await _districtRepository.DeleteAsync(id);
                return Ok(new { message = "District deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Failed to delete district",
                    error = ex.Message
                });
            }
        }
    }

    public class UserUpdateRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public int? StateId { get; set; }
        public int? DistrictId { get; set; }
        public string? Status { get; set; }
    }

    public class ChangeRoleRequest
    {
        public string Role { get; set; } = string.Empty;
    }

    public class ResetPasswordRequest
    {
        public string? CurrentPassword { get; set; }
        public string Password { get; set; } = string.Empty;
    }
}
