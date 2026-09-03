using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly IUserRepository _repository;
        private readonly IConfiguration _configuration;

        public UserController(IUserRepository repository, IConfiguration configuration)
        {
            _repository = repository;
            _configuration = configuration;
        }

        private string GenerateJwtToken(User user)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings["Key"]!)
            );
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim("firstName", user.FirstName),
                new Claim("lastName", user.LastName),
                new Claim(ClaimTypes.Role, user.Role)
            };

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
                    Role = "User"
                };

                var newId = await _repository.CreateAsync(user);

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
                        Role = "User"
                    };

                    var newId = await _repository.CreateAsync(user);
                    user.Id = newId;
                }

                // Generate backend JWT
                var token = GenerateJwtToken(user);

                // Update last login
                await _repository.UpdateLastLoginAsync(user.Id, DateTime.UtcNow);

                return Ok(new
                {
                    message = "Login successful",
                    token,
                    user = new
                    {
                        id = user.Id,
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
}
