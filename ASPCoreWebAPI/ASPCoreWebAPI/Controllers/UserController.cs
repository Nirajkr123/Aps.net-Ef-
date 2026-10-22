using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly IUserRepository _repository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IConfiguration _configuration;

        public UserController(IUserRepository repository, IEmployeeRepository employeeRepository, IConfiguration configuration)
        {
            _repository = repository;
            _employeeRepository = employeeRepository;
            _configuration = configuration;
        }

        private async Task<string> GenerateJwtTokenAsync(User user)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings["Key"]!)
            );
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var employee = await _employeeRepository.GetByUserIdAsync(user.Id);

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim("firstName", user.FirstName),
                new Claim("lastName", user.LastName),
                new Claim(ClaimTypes.Role, user.Role)
            };

            if (employee != null)
            {
                claims.Add(new Claim("employee_id", employee.Id.ToString()));
            }

            var expireMinutes =
                int.TryParse(jwtSettings["ExpireMinutes"], out var minutes)
                    ? minutes
                    : 60;

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(expireMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // =========================
        // DIRECT LOGIN (Email + Password, no Firebase)
        // =========================

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest model)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
                {
                    return BadRequest(new { message = "Email and password are required" });
                }

                var email = model.Email.Trim().ToLower();
                var user = await _repository.GetByEmailAsync(email);

                if (user == null)
                {
                    return Unauthorized(new { message = "Invalid email or password" });
                }

                if (user.Status == "Inactive")
                {
                    return Unauthorized(new { message = "Account is deactivated. Contact admin." });
                }

                if (!BCrypt.Net.BCrypt.Verify(model.Password, user.Password))
                {
                    return Unauthorized(new { message = "Invalid email or password" });
                }

                var token = await GenerateJwtTokenAsync(user);
                await _repository.UpdateLastLoginAsync(user.Id, DateTime.UtcNow);

                /* Frontend `me.id` ko `user.employeeId ?? user.id` se nikalta
                   hai. `user.id` User.Id hai (19), jabki leave/attendance
                   records me Employee.Id chahiye (20) — inka match tab hi
                   hota hai jab `employeeId` bhi bhejein. Isiliye response
                   me dono ids alag-alag jaate hain. */
                var employee = await _employeeRepository.GetByUserIdAsync(user.Id);

                return Ok(new
                {
                    message = "Login successful",
                    token,
                    user = new
                    {
                        id = user.Id,
                        employeeId = employee?.Id,
                        firstName = user.FirstName,
                        lastName = user.LastName,
                        email = user.Email,
                        role = user.Role
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }

        // =========================
        // CHANGE PASSWORD (Direct Login users)
        // =========================

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest model)
        {
            try
            {
                if (model == null || string.IsNullOrWhiteSpace(model.OldPassword) || string.IsNullOrWhiteSpace(model.NewPassword))
                {
                    return BadRequest(new { message = "Old and new password are required" });
                }

                var newPassword = model.NewPassword;

                if (newPassword.Length < 8)
                {
                    return BadRequest(new { message = "Password must be at least 8 characters long." });
                }

                if (!newPassword.Any(char.IsUpper) || !newPassword.Any(char.IsLower))
                {
                    return BadRequest(new { message = "Password must contain both uppercase and lowercase letters." });
                }

                if (!newPassword.Any(char.IsDigit))
                {
                    return BadRequest(new { message = "Password must contain at least one number." });
                }

                if (!newPassword.Any(ch => !char.IsLetterOrDigit(ch)))
                {
                    return BadRequest(new { message = "Password must contain at least one special character." });
                }

                if (model.OldPassword == newPassword)
                {
                    return BadRequest(new { message = "New password must be different from old password" });
                }

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var user = await _repository.GetByIdAsync(userId);

                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                if (!BCrypt.Net.BCrypt.Verify(model.OldPassword, user.Password))
                {
                    return BadRequest(new { message = "Old password is incorrect" });
                }

                var passwordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
                var updated = await _repository.UpdatePasswordAsync(user.Id, passwordHash);

                if (!updated)
                {
                    return StatusCode(500, new { message = "Could not update password" });
                }

                return Ok(new { message = "Password changed successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }

        // =========================
        // FIREBASE SIGNUP (Email/Password)
        // =========================

        [HttpPost("firebase-signup")]
        public async Task<IActionResult> FirebaseSignup([FromBody] FirebaseAuthModel model)
        {
            try
            {
                if (model == null || string.IsNullOrWhiteSpace(model.IdToken))
                {
                    return BadRequest(new { message = "Firebase ID token is required" });
                }

                // Verify Firebase ID token
                var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(model.IdToken);
                var email = decodedToken.Claims["email"]?.ToString()?.Trim().ToLower();
                var firebaseUid = decodedToken.Uid;

                if (string.IsNullOrWhiteSpace(email))
                {
                    return BadRequest(new { message = "Email not found in Firebase token" });
                }

                // Check if user already exists in DB (old system migration)
                var existingUser = await _repository.GetByEmailAsync(email);
                if (existingUser != null)
                {
                    // If user exists but has no FirebaseUid, link their Firebase account
                    if (string.IsNullOrWhiteSpace(existingUser.FirebaseUid))
                    {
                        await _repository.UpdateFirebaseUidAsync(existingUser.Id, firebaseUid);
                        return Ok(new
                        {
                            message = "Account linked successfully",
                            userId = existingUser.Id
                        });
                    }
                    return BadRequest(new { message = "Email already registered" });
                }

                // Check by Firebase UID
                var existingFirebaseUser = await _repository.GetByFirebaseUidAsync(firebaseUid);
                if (existingFirebaseUser != null)
                {
                    return BadRequest(new { message = "User already registered" });
                }

                // Create new user
                var user = new User
                {
                    FirstName = model.FirstName ?? "",
                    LastName = model.LastName ?? "",
                    Email = email,
                    Password = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
                    FirebaseUid = firebaseUid,
                    CreatedDate = DateTime.UtcNow,
                    Role = "EMPLOYEE"
                };

                var newId = await _repository.CreateAsync(user);

                var employeeCode = await _employeeRepository.GenerateEmployeeCodeAsync();
                var employee = new Employee
                {
                    UserId = newId,
                    EmployeeCode = employeeCode,
                    FirstName = model.FirstName ?? "",
                    LastName = model.LastName ?? "",
                    Email = email,
                    EmploymentType = "FULL_TIME",
                    ProfileComplete = false,
                    Status = "Active",
                    CreatedDate = DateTime.UtcNow
                };
                await _employeeRepository.CreateAsync(employee);

                return Ok(new
                {
                    message = "Signup successful",
                    userId = newId
                });
            }
            catch (FirebaseAuthException)
            {
                return Unauthorized(new { message = "Invalid Firebase token" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }


        // =========================
        // FIREBASE LOGIN (Email/Password + Google)
        // =========================

        [HttpPost("firebase-login")]
        public async Task<IActionResult> FirebaseLogin([FromBody] FirebaseAuthModel model)
        {
            try
            {
                if (model == null || string.IsNullOrWhiteSpace(model.IdToken))
                {
                    return BadRequest(new { message = "Firebase ID token is required" });
                }

                // Verify Firebase ID token
                var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(model.IdToken);
                var email = decodedToken.Claims["email"]?.ToString()?.Trim().ToLower();
                var firebaseUid = decodedToken.Uid;
                var name = decodedToken.Claims["name"]?.ToString() ?? "";

                if (string.IsNullOrWhiteSpace(email))
                {
                    return BadRequest(new { message = "Email not found in Firebase token" });
                }

                // Find user by email
                var user = await _repository.GetByEmailAsync(email);

                // If user not found, auto-create (for Google sign-in)
                if (user == null)
                {
                    var nameParts = name.Split(" ");
                    var firstName = model.FirstName ?? nameParts[0] ?? "";
                    var lastName = model.LastName ?? (nameParts.Length > 1 ? string.Join(" ", nameParts.Skip(1)) : "");

                    user = new User
                    {
                        FirstName = firstName,
                        LastName = lastName,
                        Email = email,
                        Password = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
                        FirebaseUid = firebaseUid,
                        CreatedDate = DateTime.UtcNow,
                        Role = "EMPLOYEE"
                    };

                    var newId = await _repository.CreateAsync(user);
                    user.Id = newId;

                    var employeeCode = await _employeeRepository.GenerateEmployeeCodeAsync();
                    var employee = new Employee
                    {
                        UserId = newId,
                        EmployeeCode = employeeCode,
                        FirstName = firstName,
                        LastName = lastName,
                        Email = email,
                        EmploymentType = "FULL_TIME",
                        ProfileComplete = false,
                        Status = "Active",
                        CreatedDate = DateTime.UtcNow
                    };
                    await _employeeRepository.CreateAsync(employee);
                }

                // Generate backend JWT
                var token = await GenerateJwtTokenAsync(user);

                // Update last login
                await _repository.UpdateLastLoginAsync(user.Id, DateTime.UtcNow);

                /* `employeeId` zaroori hai — frontend `me.id` ko
                   `user.employeeId ?? user.id` se nikalta hai, aur leave/
                   attendance records Employee.Id par hain (User.Id par
                   nahi). Iske bina employee page khaali rehta hai. */
                var currentEmployee = await _employeeRepository.GetByUserIdAsync(user.Id);

                return Ok(new
                {
                    message = "Login successful",
                    token,
                    user = new
                    {
                        id = user.Id,
                        employeeId = currentEmployee?.Id,
                        firstName = user.FirstName,
                        lastName = user.LastName,
                        email = user.Email,
                        role = user.Role
                    }
                });
            }
            catch (FirebaseAuthException)
            {
                return Unauthorized(new { message = "Invalid Firebase token" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class ChangePasswordRequest
    {
        public string OldPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }
}
