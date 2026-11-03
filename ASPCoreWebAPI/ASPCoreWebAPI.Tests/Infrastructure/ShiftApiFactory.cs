using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace ASPCoreWebAPI.Tests.Infrastructure;

public sealed class ShiftApiFactory : WebApplicationFactory<Program>
{
    public const string JwtKey = "Shift-Tests-Super-Secret-Key-Only-For-Tests-1234567890";
    public const string JwtIssuer = "ASPCoreWebAPI";
    public const string JwtAudience = "ASPCoreWebAPIClient";

    private readonly DatabaseFixture _database;

    public ShiftApiFactory(DatabaseFixture database)
    {
        _database = database;

        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", database.ConnectionString);
        Environment.SetEnvironmentVariable("Jwt__Key", JwtKey);
        Environment.SetEnvironmentVariable("Jwt__Issuer", JwtIssuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", JwtAudience);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _database.ConnectionString,
                ["Jwt:Key"] = JwtKey,
                ["Jwt:Issuer"] = JwtIssuer,
                ["Jwt:Audience"] = JwtAudience,
                ["Jwt:ExpireMinutes"] = "60",
                ["Firebase:ServiceAccountKeyPath"] = "config/does-not-exist-in-tests.json"
            });
        });
    }

    public HttpClient CreateAuthenticatedClient(string role = "OWNER", int userId = 1)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                CreateToken(role, userId));
        return client;
    }

    public static string CreateToken(string role, int userId)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role),
            new Claim(ClaimTypes.Name, $"{role.ToLowerInvariant()}-{userId}")
        };

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
