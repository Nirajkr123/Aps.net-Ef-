using System.Net;
using ASPCoreWebAPI.Tests.Infrastructure;
using Xunit;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public sealed class PayrollSecurityApiTests : IAsyncLifetime
{
    private readonly DatabaseFixture _database;
    private readonly ShiftApiFactory _factory;

    public PayrollSecurityApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new ShiftApiFactory(database);
    }

    public Task InitializeAsync() => _database.ResetAsync();

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Theory]
    [InlineData("/api/payroll/runs")]
    [InlineData("/api/me/payslips")]
    public async Task PayrollEndpoints_WithoutToken_Return401(string url)
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PayrollAdminEndpoints_AsEmployee_Return403()
    {
        using var client = _factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await client.GetAsync("/api/payroll/runs");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PayrollAdminEndpoints_AsHr_Return200()
    {
        using var client = _factory.CreateAuthenticatedClient("HR", 2);

        var response = await client.GetAsync("/api/payroll/runs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task EmployeeCannotCreateSalaryStructure()
    {
        using var client = _factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await client.PostAsync(
            "/api/payroll/salary-structures",
            new StringContent(
                """{"employeeId":101,"basic":10000,"hra":1000,"allowances":0,"effectiveFrom":"2026-01-01"}""",
                System.Text.Encoding.UTF8,
                "application/json"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
