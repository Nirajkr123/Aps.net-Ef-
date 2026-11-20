using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public sealed class ShiftModuleCoverageTests : IAsyncLifetime
{
    private readonly DatabaseFixture _database;
    private readonly ShiftApiFactory _factory;

    public ShiftModuleCoverageTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new ShiftApiFactory(database);
    }

    public Task InitializeAsync() => _database.ResetAsync();

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Theory]
    [InlineData("EMPLOYEE")]
    [InlineData("MANAGER")]
    public async Task ShiftAdminEndpoints_UnsupportedRole_Returns403(string role)
    {
        using var client = _factory.CreateAuthenticatedClient(role, 3, 101);

        var responses = new[]
        {
            await client.GetAsync("/api/shifts"),
            await client.GetAsync("/api/shifts/active"),
            await client.GetAsync("/api/shifts/1"),
            await client.GetAsync("/api/shift-assignments/batches"),
            await client.GetAsync("/api/shift-assignments/batches/1"),
            await client.GetAsync("/api/shift-assignments/batches/1/assignments"),
            await client.PostAsJsonAsync("/api/shifts", ValidShift()),
            await client.PutAsJsonAsync("/api/shifts/1", ValidShift("Changed")),
            await client.PatchAsJsonAsync("/api/shifts/1/status", new { isActive = false }),
            await client.PostAsJsonAsync("/api/shift-assignments/bulk", ValidAssignment()),
            await client.PostAsJsonAsync("/api/shift-assignments/bulk/preview", ValidAssignment()),
            await client.PatchAsync("/api/shift-assignments/batches/1/cancel", null)
        };

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode));
    }

    [Fact]
    public async Task ShiftEndpoints_WithoutToken_Return401()
    {
        using var client = _factory.CreateClient();

        var responses = new[]
        {
            await client.GetAsync("/api/shifts"),
            await client.GetAsync("/api/shifts/active"),
            await client.GetAsync("/api/shifts/1"),
            await client.PostAsJsonAsync("/api/shifts", ValidShift()),
            await client.PutAsJsonAsync("/api/shifts/1", ValidShift("Changed")),
            await client.PatchAsJsonAsync("/api/shifts/1/status", new { isActive = false }),
            await client.GetAsync("/api/shift-assignments/batches"),
            await client.GetAsync("/api/shift-assignments/batches/1"),
            await client.GetAsync("/api/shift-assignments/batches/1/assignments"),
            await client.PostAsJsonAsync("/api/shift-assignments/bulk", ValidAssignment()),
            await client.PostAsJsonAsync("/api/shift-assignments/bulk/preview", ValidAssignment()),
            await client.PatchAsync("/api/shift-assignments/batches/1/cancel", null)
        };

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode));
    }

    [Fact]
    public async Task Hr_CanCreateEditDeactivateAndReadShift()
    {
        using var client = _factory.CreateAuthenticatedClient("HR", 2);

        var createResponse = await client.PostAsJsonAsync("/api/shifts", ValidShift("Morning 06-14"));
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<ShiftResponse>();
        Assert.NotNull(created);
        Assert.Equal("14:00:00", created!.EndTime);
        Assert.False(created.CrossesMidnight);

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/shifts/{created.ShiftId}",
            new { shiftName = "Morning Updated", startTime = "06:00", durationHours = 8 });
        updateResponse.EnsureSuccessStatusCode();

        var statusResponse = await client.PatchAsJsonAsync(
            $"/api/shifts/{created.ShiftId}/status",
            new { isActive = false });
        statusResponse.EnsureSuccessStatusCode();

        var getResponse = await client.GetAsync($"/api/shifts/{created.ShiftId}");
        getResponse.EnsureSuccessStatusCode();
        var actual = await getResponse.Content.ReadFromJsonAsync<ShiftResponse>();
        Assert.Equal("Morning Updated", actual!.ShiftName);
        Assert.False(actual.IsActive);
    }

    [Theory]
    [InlineData("", "06:00", 8)]
    [InlineData("Valid", "not-a-time", 8)]
    [InlineData("Valid", "06:00", 0)]
    [InlineData("Valid", "06:00", 24)]
    public async Task CreateShift_InvalidPayload_Returns400(
        string shiftName,
        string startTime,
        decimal durationHours)
    {
        using var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/shifts", new
        {
            shiftName,
            startTime,
            durationHours,
            isActive = true
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateShift_NameOver100Characters_Returns400()
    {
        using var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync(
            "/api/shifts",
            ValidShift(new string('x', 101)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateShift_CaseInsensitiveDuplicate_Returns400AndDoesNotDuplicate()
    {
        using var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/shifts", ValidShift(" shift a "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(1, await _database.ScalarAsync<int>(
            "SELECT COUNT(*) FROM \"shift\" WHERE LOWER(BTRIM(shift_name)) = 'shift a'"));
    }

    [Fact]
    public async Task CreateShift_EmojiAndMarkup_RoundTripsAsData()
    {
        using var client = _factory.CreateAuthenticatedClient();
        const string name = "Night <script>alert(1)</script> 🌙";

        var createResponse = await client.PostAsJsonAsync("/api/shifts", ValidShift(name));
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<ShiftResponse>();

        var getResponse = await client.GetAsync($"/api/shifts/{created!.ShiftId}");
        getResponse.EnsureSuccessStatusCode();
        var actual = await getResponse.Content.ReadFromJsonAsync<ShiftResponse>();
        Assert.Equal(name, actual!.ShiftName);
    }

    [Fact]
    public async Task BulkAssign_InactiveShift_Returns400AndWritesNothing()
    {
        using var client = _factory.CreateAuthenticatedClient();
        var status = await client.PatchAsJsonAsync("/api/shifts/1/status", new { isActive = false });
        status.EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync(
            "/api/shift-assignments/bulk",
            ValidAssignment());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await _database.ScalarAsync<int>("SELECT COUNT(*) FROM assignment_batch"));
        Assert.Equal(0, await _database.ScalarAsync<int>("SELECT COUNT(*) FROM shift_assignment"));
    }

    [Fact]
    public async Task BulkAssign_DuplicateEmployeeIds_WritesOneAssignment()
    {
        using var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-11-18",
            toDate = "2026-11-18",
            employeeIds = new[] { 101, 101, 101 }
        });

        response.EnsureSuccessStatusCode();
        Assert.Equal(1, await _database.ScalarAsync<int>(
            "SELECT COUNT(*) FROM shift_assignment WHERE emp_id = 101"));
    }

    [Fact]
    public async Task BulkAssign_ConcurrentDuplicateSubmissions_CreateOneActiveAssignment()
    {
        using var firstClient = _factory.CreateAuthenticatedClient();
        using var secondClient = _factory.CreateAuthenticatedClient("HR", 2);

        var responses = await Task.WhenAll(
            firstClient.PostAsJsonAsync("/api/shift-assignments/bulk", ValidAssignment()),
            secondClient.PostAsJsonAsync("/api/shift-assignments/bulk", ValidAssignment()));

        Assert.Contains(responses, response => response.IsSuccessStatusCode);
        Assert.Equal(1, await _database.ScalarAsync<int>(
            "SELECT COUNT(*) FROM shift_assignment WHERE emp_id = 101 AND status = 'Assigned'"));
    }

    [Fact]
    public async Task ConcurrentDuplicateShiftCreate_ReturnsControlledConflictAndCreatesOneRow()
    {
        using var owner = _factory.CreateAuthenticatedClient();
        using var hr = _factory.CreateAuthenticatedClient("HR", 2);

        var responses = await Task.WhenAll(
            owner.PostAsJsonAsync("/api/shifts", ValidShift("Concurrent Shift")),
            hr.PostAsJsonAsync("/api/shifts", ValidShift("Concurrent Shift")));

        Assert.Single(responses.Where(response => response.IsSuccessStatusCode));
        Assert.All(
            responses.Where(response => !response.IsSuccessStatusCode),
            response => Assert.Contains(response.StatusCode, new[]
            {
                HttpStatusCode.BadRequest,
                HttpStatusCode.Conflict
            }));
        Assert.Equal(1, await _database.ScalarAsync<int>(
            "SELECT COUNT(*) FROM \"shift\" WHERE shift_name = 'Concurrent Shift'"));
    }

    [Fact]
    public async Task NoOpShiftUpdate_DoesNotChangeUpdatedTimestamp()
    {
        using var client = _factory.CreateAuthenticatedClient();
        var before = await client.GetFromJsonAsync<ShiftResponse>("/api/shifts/1");
        await Task.Delay(20);

        var response = await client.PutAsJsonAsync("/api/shifts/1", new
        {
            shiftName = before!.ShiftName,
            startTime = before.StartTime,
            durationHours = before.DurationHours,
            isActive = before.IsActive
        });
        response.EnsureSuccessStatusCode();
        var after = await response.Content.ReadFromJsonAsync<ShiftResponse>();

        Assert.Equal(before.UpdatedAt, after!.UpdatedAt);
    }

    [Fact]
    public async Task CancelBatch_Twice_ReturnsConflictOnSecondAttempt()
    {
        using var client = _factory.CreateAuthenticatedClient();
        var assign = await client.PostAsJsonAsync(
            "/api/shift-assignments/bulk",
            ValidAssignment());
        assign.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await assign.Content.ReadAsStringAsync());
        var batchId = body.RootElement.GetProperty("batchId").GetInt32();

        var first = await client.PatchAsync(
            $"/api/shift-assignments/batches/{batchId}/cancel",
            null);
        first.EnsureSuccessStatusCode();
        var second = await client.PatchAsync(
            $"/api/shift-assignments/batches/{batchId}/cancel",
            null);

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task InactiveHrToken_CannotReadShiftCatalog()
    {
        await _database.ExecuteAsync(
            """
            INSERT INTO "Users" ("Id", "FirstName", "LastName", "Email", "Role", "Status")
            VALUES (4, 'Inactive', 'HR', 'inactive-hr@shift-tests.local', 'HR', 'Inactive');
            """);
        using var client = _factory.CreateAuthenticatedClient("HR", 4);

        var response = await client.GetAsync("/api/shifts");

        Assert.Contains(response.StatusCode, new[]
        {
            HttpStatusCode.Unauthorized,
            HttpStatusCode.Forbidden
        });
    }

    [Fact]
    public async Task ShiftResponses_DoNotLeakSensitiveFields()
    {
        using var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/shifts");
        response.EnsureSuccessStatusCode();
        var body = (await response.Content.ReadAsStringAsync()).ToLowerInvariant();

        Assert.DoesNotContain("password", body);
        Assert.DoesNotContain("salary", body);
        Assert.DoesNotContain("hash", body);
        Assert.DoesNotContain("jwt", body);
    }

    private static object ValidShift(string name = "Morning") => new
    {
        shiftName = name,
        startTime = "06:00",
        durationHours = 8,
        isActive = true
    };

    private static object ValidAssignment() => new
    {
        shiftId = 1,
        fromDate = "2026-11-18",
        toDate = "2026-11-18",
        employeeIds = new[] { 101 },
        workDescription = "Coverage test"
    };

    private sealed record ShiftResponse(
        int ShiftId,
        string ShiftName,
        string StartTime,
        decimal DurationHours,
        string EndTime,
        bool CrossesMidnight,
        bool IsActive,
        DateTime UpdatedAt);
}
