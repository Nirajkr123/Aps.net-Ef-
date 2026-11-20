using System.Net;
using Hrms.Tests.Infrastructure;

namespace Hrms.Tests;

public sealed class AccessAndUsersTests : ApiTestBase
{
    public AccessAndUsersTests(TestHost host) : base(host) { }

    public static TheoryData<string> AdminUrls => new()
    {
        "/api/Employee",
        "/api/Employee/stats",
        "/api/Department",
        "/api/Designation",
        "/api/Shifts",
        "/api/shift-assignments/batches",
        "/api/payroll/runs",
        "/api/payroll/salary-structures",
        "/api/Admin/users",
        "/api/work-locations",
        "/api/attendance/all",
    };

    [Theory]
    [MemberData(nameof(AdminUrls))]
    public async Task AdminEndpoints_WithoutToken_Return401(string url)
    {
        using var client = Anonymous();
        var response = await GetAsync(client, url);
        Assert.Equal(401, response.Status);
    }

    [Theory]
    [MemberData(nameof(AdminUrls))]
    public async Task AdminEndpoints_AsEmployee_Return403(string url)
    {
        using var client = Employee(102);
        var response = await GetAsync(client, url);
        Assert.Equal(403, response.Status);
    }

    [Fact]
    public async Task InvalidToken_Returns401()
    {
        using var client = Anonymous();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "not-a-jwt");
        var response = await GetAsync(client, "/api/Employee");
        Assert.Equal(401, response.Status);
    }

    [Fact]
    public async Task Employee_CannotReadAnotherEmployeeById()
    {
        using var client = Employee(102);
        var response = await GetAsync(client, "/api/Employee/103");
        Assert.Equal(403, response.Status);
    }

    [Fact]
    public async Task Employee_CannotReadAnotherEmployeesPayslip()
    {
        await SeedAsync();
        using var client = Employee(103);
        var response = await GetAsync(client, "/api/me/payslips/1");
        Assert.Equal(404, response.Status);
    }

    [Fact]
    public async Task Employee_OnlySeesPublishedPayslips()
    {
        await SeedAsync();
        using var client = Employee(102);

        var list = await GetAsync(client, "/api/me/payslips");
        Assert.Equal(200, list.Status);
        var items = list.Json as System.Text.Json.Nodes.JsonArray
            ?? (list.Json as System.Text.Json.Nodes.JsonObject)?["items"] as System.Text.Json.Nodes.JsonArray;
        Assert.NotNull(items);

        var draft = await GetAsync(client, "/api/me/payslips/3");
        Assert.Equal(404, draft.Status);
    }

    [Fact]
    public async Task Hr_CannotCreateAdminOrHrUser()
    {
        using var client = Hr();
        var response = await PostAsync(client, "/api/Admin/users", new
        {
            firstName = "New",
            lastName = "Hr",
            email = "newhr@hrms-test.local",
            password = "Test@1234",
            role = "HR"
        });
        Assert.Equal(403, response.Status);
    }

    [Fact]
    public async Task Hr_CannotChangeRoleOrDeleteUser()
    {
        using var client = Hr();

        var role = await PostAsync(client, "/api/Admin/users/2/role", new { role = "OWNER" });
        Assert.Equal(403, role.Status);

        var delete = await DeleteAsync(client, "/api/Admin/users/2");
        Assert.Equal(403, delete.Status);
    }

    [Fact]
    public async Task Hr_CannotDeactivateOwnerAccount()
    {
        await SeedAsync();
        using var client = Hr();
        var response = await PostAsync(client, "/api/Admin/users/1/deactivate");
        Assert.Equal(403, response.Status);
    }

    [Fact]
    public async Task Hr_CannotUpdateOwnerRole()
    {
        await SeedAsync();
        using var client = Hr();
        var response = await PutAsync(client, "/api/Admin/users/1", new { role = "HR" });
        Assert.Equal(403, response.Status);
    }

    [Fact]
    public async Task Owner_CanCreateUser_AndDisabledUserCannotLogin()
    {
        await SeedAsync();
        using var owner = Owner();

        var created = await PostAsync(owner, "/api/Admin/users", new
        {
            firstName = "New",
            lastName = "Hr",
            email = "newhr2@hrms-test.local",
            password = "Test@1234",
            role = "HR"
        });
        Assert.Equal(200, created.Status);
        var userId = IdOf(created);
        Assert.True(userId > 0);

        using var anonymous = Anonymous();
        var login = await PostAsync(anonymous, "/api/User/login", new
        {
            email = "newhr2@hrms-test.local",
            password = "Test@1234"
        });
        Assert.Equal(200, login.Status);

        var deactivate = await PostAsync(owner, $"/api/Admin/users/{userId}/deactivate");
        Assert.Equal(200, deactivate.Status);

        var blocked = await PostAsync(anonymous, "/api/User/login", new
        {
            email = "newhr2@hrms-test.local",
            password = "Test@1234"
        });
        Assert.Equal(401, blocked.Status);
    }

    [Fact]
    public async Task InactiveSeededUser_CannotLogin()
    {
        await SeedAsync();
        using var client = Anonymous();
        var response = await PostAsync(client, "/api/User/login", new
        {
            email = "emp5@hrms-test.local",
            password = "Test@1234"
        });
        Assert.Equal(401, response.Status);
    }

    [Fact]
    public async Task UserResponses_DoNotLeakPasswordHash()
    {
        await SeedAsync();
        using var owner = Owner();

        var users = await GetAsync(owner, "/api/Admin/users");
        Assert.Equal(200, users.Status);
        Assert.DoesNotContain("password", users.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("bcrypt", users.Text, StringComparison.OrdinalIgnoreCase);

        using var anonymous = Anonymous();
        var login = await PostAsync(anonymous, "/api/User/login", new
        {
            email = "owner@hrms-test.local",
            password = "Test@1234"
        });
        Assert.Equal(200, login.Status);
        Assert.DoesNotContain("password", login.Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task EmployeeDeactivation_ShouldBlockLogin()
    {
        await SeedAsync();
        using var hr = Hr();

        var deactivate = await PatchAsync(hr, "/api/Employee/103/deactivate");
        Assert.Equal(200, deactivate.Status);

        using var anonymous = Anonymous();
        var login = await PostAsync(anonymous, "/api/User/login", new
        {
            email = "emp2@hrms-test.local",
            password = "Test@1234"
        });
        Assert.Equal(401, login.Status);
    }

    [Fact]
    public async Task DepartmentDelete_WithEmployees_ShouldBeBlocked()
    {
        await SeedAsync();
        using var owner = Owner();
        var response = await DeleteAsync(owner, "/api/Department/1");
        Assert.True(response.Status is 400 or 409,
            $"Expected blocked delete for department with employees, got {response.Status}.");
    }

    [Fact]
    public async Task DesignationDelete_WithEmployees_ShouldBeBlocked()
    {
        await SeedAsync();
        using var owner = Owner();
        var response = await DeleteAsync(owner, "/api/Designation/1");
        Assert.True(response.Status is 400 or 409,
            $"Expected blocked delete for designation with employees, got {response.Status}.");
    }
}
