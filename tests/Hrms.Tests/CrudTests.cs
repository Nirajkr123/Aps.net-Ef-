using System.Net;
using System.Text.Json.Nodes;
using Hrms.Tests.Infrastructure;

namespace Hrms.Tests;

public sealed class CrudTests : ApiTestBase
{
    public CrudTests(TestHost host) : base(host) { }

    [Fact]
    public async Task Departments_List_Stats_And_Create()
    {
        await SeedAsync();
        using var client = Owner();

        var list = await GetAsync(client, "/api/Department");
        Assert.Equal(200, list.Status);
        Assert.Equal(3, Count(list.Json));

        var stats = await GetAsync(client, "/api/Department/stats");
        Assert.Equal(200, stats.Status);
        Assert.Equal(3, stats.Json?["total"]?.GetValue<int>());

        var created = await PostAsync(client, "/api/Department", new
        {
            name = "Finance",
            description = "Accounts"
        });
        Assert.Equal(200, created.Status);
        Assert.True(IdOf(created) > 0);

        var after = await GetAsync(client, "/api/Department");
        Assert.Equal(4, Count(after.Json));
    }

    [Fact]
    public async Task Departments_DuplicateEmptyAndLongName_AreRejected()
    {
        await SeedAsync();
        using var client = Owner();

        Assert.Equal(400, (await PostAsync(client, "/api/Department", new { name = "Engineering" })).Status);
        Assert.Equal(400, (await PostAsync(client, "/api/Department", new { name = "   " })).Status);

        var longName = new string('A', 120);
        var longResponse = await PostAsync(client, "/api/Department", new { name = longName });
        Assert.Equal(400, longResponse.Status);
    }

    [Fact]
    public async Task Departments_Update_Toggle_And_HrDeleteBlocked()
    {
        await SeedAsync();
        using var owner = Owner();
        using var hr = Hr();

        var update = await PutAsync(owner, "/api/Department/1", new
        {
            name = "Platform Engineering",
            description = "Updated",
            status = "Active"
        });
        Assert.Equal(200, update.Status);

        var detail = await GetAsync(owner, "/api/Department/1");
        Assert.Equal("Platform Engineering", detail.Json?["name"]?.GetValue<string>());

        var toggle = await PatchAsync(owner, "/api/Department/2/toggle-status");
        Assert.Equal(200, toggle.Status);
        Assert.Equal("Inactive", toggle.Json?["status"]?.GetValue<string>());

        Assert.Equal(403, (await DeleteAsync(hr, "/api/Department/2")).Status);
    }

    [Fact]
    public async Task Designations_AreLinkedToDepartment_AndDuplicateBlocked()
    {
        await SeedAsync();
        using var client = Hr();

        var list = await GetAsync(client, "/api/Designation?departmentId=1");
        Assert.Equal(200, list.Status);
        Assert.Equal(1, Count(list.Json));

        var created = await PostAsync(client, "/api/Designation", new
        {
            title = "Senior Engineer",
            departmentId = 1
        });
        Assert.Equal(200, created.Status);

        var duplicate = await PostAsync(client, "/api/Designation", new
        {
            title = "Senior Engineer",
            departmentId = 1
        });
        Assert.Equal(400, duplicate.Status);

        var missingDept = await PostAsync(client, "/api/Designation", new
        {
            title = "Floating",
            departmentId = 0
        });
        Assert.Equal(400, missingDept.Status);

        Assert.Equal(403, (await DeleteAsync(client, "/api/Designation/1")).Status);
    }

    [Fact]
    public async Task Employee_Create_Search_Stats_AndLogin()
    {
        await SeedAsync();
        using var hr = Hr();

        var search = await GetAsync(hr, "/api/Employee?search=Ram");
        Assert.Equal(200, search.Status);
        Assert.Equal(1, Count(search.Json));

        var stats = await GetAsync(hr, "/api/Employee/stats");
        Assert.Equal(200, stats.Status);
        Assert.Equal(6, stats.Json?["total"]?.GetValue<int>());
        Assert.Equal(1, stats.Json?["incompleteProfiles"]?.GetValue<int>());

        var created = await PostAsync(hr, "/api/Employee", new
        {
            firstName = "New",
            lastName = "Joiner",
            email = "newjoiner@hrms-test.local",
            departmentId = 1,
            designationId = 1,
            joiningDate = "2026-01-01",
            employmentType = "FULL_TIME"
        });
        Assert.Equal(200, created.Status);
        Assert.True(IdOf(created) > 0);

        var duplicate = await PostAsync(hr, "/api/Employee", new
        {
            firstName = "Dup",
            email = "newjoiner@hrms-test.local"
        });
        Assert.Equal(400, duplicate.Status);

        using var anonymous = Anonymous();
        var login = await PostAsync(anonymous, "/api/User/login", new
        {
            email = "newjoiner@hrms-test.local",
            password = "Employee@123"
        });
        Assert.Equal(200, login.Status);
        Assert.Equal("EMPLOYEE", login.Json?["user"]?["role"]?.GetValue<string>());

        var token = login.Json?["token"]?.GetValue<string>();
        using var self = Anonymous();
        self.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var me = await GetAsync(self, "/api/Employee/me");
        Assert.Equal(200, me.Status);
        Assert.Equal("New", me.Json?["firstName"]?.GetValue<string>());
    }

    [Fact]
    public async Task Employee_SelfUpdate_OnlyChangesAllowedFields()
    {
        await SeedAsync();
        using var client = Employee(102);

        var update = await PutAsync(client, "/api/Employee/me/update", new
        {
            phone = "9111111111",
            address = "New Address",
            emergencyContact = "9222222222",
            departmentId = 2,
            designationId = 2,
            status = "Inactive"
        });
        Assert.Equal(200, update.Status);

        var me = await GetAsync(client, "/api/Employee/me");
        Assert.Equal(200, me.Status);
        Assert.Equal("9111111111", me.Json?["phone"]?.GetValue<string>());
        Assert.Equal(1, me.Json?["departmentId"]?.GetValue<int>());
        Assert.Equal("Active", me.Json?["status"]?.GetValue<string>());
    }

    [Fact]
    public async Task WorkLocations_EmployeeCanReadActive_ButNotWrite()
    {
        await SeedAsync();
        using var employee = Employee(102);

        var active = await GetAsync(employee, "/api/work-locations/active");
        Assert.Equal(200, active.Status);
        Assert.Equal(1, Count(active.Json));

        var write = await PostAsync(employee, "/api/work-locations", new
        {
            name = "Hack",
            latitude = 1,
            longitude = 1,
            radiusMeters = 10
        });
        Assert.Equal(403, write.Status);
    }

    [Fact]
    public async Task WorkLocations_ValidationAndMissingDelete()
    {
        await SeedAsync();
        using var hr = Hr();

        Assert.Equal(400, (await PostAsync(hr, "/api/work-locations", new { name = "", latitude = 1, longitude = 1 })).Status);
        Assert.Equal(400, (await PostAsync(hr, "/api/work-locations", new { name = "BadLat", latitude = 100, longitude = 1 })).Status);
        Assert.Equal(400, (await PostAsync(hr, "/api/work-locations", new { name = "BadRadius", latitude = 1, longitude = 1, radiusMeters = 0 })).Status);

        var duplicate = await PostAsync(hr, "/api/work-locations", new
        {
            name = "Head Office",
            latitude = 28.6139,
            longitude = 77.2090,
            radiusMeters = 100
        });
        Assert.Equal(400, duplicate.Status);

        Assert.Equal(405, (await DeleteAsync(hr, "/api/work-locations/2")).Status);
    }

    [Fact]
    public async Task Shifts_CreateUpdateStatus_AndDuplicate()
    {
        await SeedAsync();
        using var hr = Hr();

        var list = await GetAsync(hr, "/api/shifts");
        Assert.Equal(200, list.Status);
        Assert.Equal(3, Count(list.Json));

        var created = await PostAsync(hr, "/api/shifts", new
        {
            shiftName = "Evening",
            startTime = "18:00",
            durationHours = 4
        });
        Assert.Equal(200, created.Status);
        Assert.Equal("Evening", created.Json?["shiftName"]?.GetValue<string>());

        var duplicate = await PostAsync(hr, "/api/shifts", new
        {
            shiftName = "Morning",
            startTime = "06:00",
            durationHours = 8
        });
        Assert.True(duplicate.Status is 400 or 409,
            $"Duplicate shift name should be blocked, got {duplicate.Status}.");

        Assert.Equal(400, (await PostAsync(hr, "/api/shifts", new { shiftName = "Bad", startTime = "25:99", durationHours = 8 })).Status);
        Assert.Equal(400, (await PostAsync(hr, "/api/shifts", new { shiftName = "Bad2", startTime = "10:00", durationHours = 0 })).Status);

        var status = await PatchAsync(hr, "/api/shifts/2/status", new { isActive = false });
        Assert.Equal(200, status.Status);
        Assert.False(status.Json?["isActive"]?.GetValue<bool>());

        var delete = await DeleteAsync(hr, "/api/shifts/2");
        Assert.Equal(405, delete.Status);
    }

    [Fact]
    public async Task ShiftAssignment_PreviewDoesNotWrite_AndInactiveShiftBlocked()
    {
        await SeedAsync();
        using var hr = Hr();
        var before = await ScalarAsync("SELECT count(*) FROM shift_assignment");

        var preview = await PostAsync(hr, "/api/shift-assignments/bulk/preview", new
        {
            shiftId = 2,
            fromDate = DateTime.UtcNow.Date.AddDays(1).ToString("yyyy-MM-dd"),
            toDate = DateTime.UtcNow.Date.AddDays(1).ToString("yyyy-MM-dd"),
            employeeIds = new[] { 105 }
        });
        Assert.Equal(200, preview.Status);
        Assert.True(preview.Json?["dryRun"]?.GetValue<bool>());

        var after = await ScalarAsync("SELECT count(*) FROM shift_assignment");
        Assert.Equal(before, after);

        await PatchAsync(hr, "/api/shifts/2/status", new { isActive = false });
        var blocked = await PostAsync(hr, "/api/shift-assignments/bulk", new
        {
            shiftId = 2,
            fromDate = DateTime.UtcNow.Date.AddDays(1).ToString("yyyy-MM-dd"),
            toDate = DateTime.UtcNow.Date.AddDays(1).ToString("yyyy-MM-dd"),
            employeeIds = new[] { 105 }
        });
        Assert.Equal(400, blocked.Status);
    }

    [Fact]
    public async Task DepartmentName_StoresSqlAndXssPayloadsSafely()
    {
        await SeedAsync();
        using var owner = Owner();

        var sql = await PostAsync(owner, "/api/Department", new
        {
            name = "QA'); DROP TABLE \"Departments\";--"
        });
        Assert.Equal(200, sql.Status);

        var xss = await PostAsync(owner, "/api/Department", new
        {
            name = "<script>alert('x')</script>"
        });
        Assert.Equal(200, xss.Status);

        var list = await GetAsync(owner, "/api/Department");
        Assert.Equal(200, list.Status);
        Assert.Contains("<script>alert", list.Text);
        Assert.Equal(1, await ScalarAsync("SELECT count(*) FROM information_schema.tables WHERE table_name='Departments'"));
    }
}
