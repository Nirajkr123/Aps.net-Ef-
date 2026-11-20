using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace Hrms.Tests.Infrastructure;

public sealed class MutableClock : IClock
{
    public DateTime UtcNow { get; set; } = DateTime.UtcNow;

    public void Reset() => UtcNow = DateTime.UtcNow;

    public void SetIst(int hour, int minute, int addDays = 0)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        var todayIst = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone).Date.AddDays(addDays);
        var ist = todayIst.AddHours(hour).AddMinutes(minute);
        UtcNow = TimeZoneInfo.ConvertTimeToUtc(ist, zone);
    }
}

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string JwtKey = "Hrms-Module-Tests-Secret-Key-123456789012345678";
    public const string JwtIssuer = "ASPCoreWebAPI";
    public const string JwtAudience = "ASPCoreWebAPIClient";

    private readonly MutableClock _clock;

    public ApiFactory(MutableClock clock)
    {
        _clock = clock;
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", TestDb.ConnectionString);
        Environment.SetEnvironmentVariable("Jwt__Key", JwtKey);
        Environment.SetEnvironmentVariable("Jwt__Issuer", JwtIssuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", JwtAudience);
        Environment.SetEnvironmentVariable("Jwt__ExpireMinutes", "60");
        Environment.SetEnvironmentVariable("Attendance__FallbackTimeZone", "Asia/Kolkata");
        Environment.SetEnvironmentVariable("Firebase__ServiceAccountKeyPath", "config/none-in-tests.json");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IClock>();
            services.AddSingleton<IClock>(_clock);
        });
    }

    public HttpClient Client(string role, int userId, int? employeeId = null)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", Token(role, userId, employeeId));
        return client;
    }

    public HttpClient Anonymous() =>
        CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    public static string Token(string role, int userId, int? employeeId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role),
            new(ClaimTypes.Name, $"{role.ToLowerInvariant()}-{userId}"),
        };

        if (employeeId.HasValue)
            claims.Add(new Claim("employee_id", employeeId.Value.ToString()));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
