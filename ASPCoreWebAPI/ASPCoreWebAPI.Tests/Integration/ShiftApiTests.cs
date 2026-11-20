using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class ShiftApiTests : IAsyncLifetime
{
    private readonly DatabaseFixture _database;
    private readonly ShiftApiFactory _factory;
    private readonly HttpClient _client;

    public ShiftApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new ShiftApiFactory(database);
        _client = _factory.CreateAuthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _database.ResetAsync();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    [Fact]
    public async Task GetShifts_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/shifts");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetShifts_AsEmployee_Returns403()
    {
        using var client = _factory.CreateAuthenticatedClient("EMPLOYEE", 3);

        var response = await client.GetAsync("/api/shifts");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetShifts_AsOwner_ReturnsSeededCatalog()
    {
        var response = await _client.GetAsync("/api/shifts");

        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var names = json.RootElement
            .EnumerateArray()
            .Select(shift => shift.GetProperty("shiftName").GetString() ?? string.Empty)
            .ToArray();

        Assert.Equal(["Shift A", "Shift B", "Shift C"], names);
    }

    [Fact]
    public async Task BulkAssign_IgnoresClientSuppliedTimeFields()
    {
        var response = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101 },
            workDescription = "Integration test",
            startTime = "23:00",
            endTime = "23:30",
            crossesMidnight = true
        });

        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<BulkResponse>();
        Assert.NotNull(result);
        Assert.NotNull(result!.BatchId);
        Assert.Equal(1, result.SavedCount);
        Assert.Equal(1, result.TotalEmployees);
        Assert.Equal(1, result.TotalAssignments);

        var assignmentsResponse = await _client.GetAsync(
            $"/api/shift-assignments/batches/{result.BatchId!.Value}/assignments");
        assignmentsResponse.EnsureSuccessStatusCode();
        var assignments = await assignmentsResponse.Content
            .ReadFromJsonAsync<List<AssignmentResponse>>();

        var assignment = Assert.Single(assignments!);
        Assert.Equal(new DateTime(2026, 10, 31, 6, 0, 0), assignment.ShiftStartDt);
        Assert.Equal(new DateTime(2026, 10, 31, 16, 0, 0), assignment.ShiftEndDt);
        Assert.Equal(new DateTime(2026, 10, 31), assignment.ShiftDate);
    }

    [Fact]
    public async Task BulkAssign_ShiftC_ReturnsCrossMidnightWindow()
    {
        var response = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 3,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101 }
        });

        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<BulkResponse>();

        var assignmentsResponse = await _client.GetAsync(
            $"/api/shift-assignments/batches/{result!.BatchId!.Value}/assignments");
        var assignments = await assignmentsResponse.Content
            .ReadFromJsonAsync<List<AssignmentResponse>>();
        var assignment = Assert.Single(assignments!);

        Assert.Equal(new DateTime(2026, 10, 31, 20, 0, 0), assignment.ShiftStartDt);
        Assert.Equal(new DateTime(2026, 11, 1, 6, 0, 0), assignment.ShiftEndDt);
    }

    [Fact]
    public async Task BulkAssign_StrictConflict_Returns409AndSavesNothing()
    {
        var first = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101 }
        });
        first.EnsureSuccessStatusCode();

        var response = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101, 102 },
            strict = true
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var skipped = json.RootElement.GetProperty("skipped");
        Assert.Equal(1, skipped.GetArrayLength());
        Assert.Equal(101, skipped[0].GetProperty("empId").GetInt32());

        var batchesResponse = await _client.GetAsync("/api/shift-assignments/batches");
        using var batchesJson = JsonDocument.Parse(await batchesResponse.Content.ReadAsStringAsync());
        Assert.Equal(1, batchesJson.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task BulkAssign_PartialConflict_Returns200AndSavesOtherEmployee()
    {
        var first = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101 }
        });
        first.EnsureSuccessStatusCode();

        var response = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 2,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101, 102 }
        });

        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<BulkResponse>();
        Assert.NotNull(result);
        Assert.NotNull(result!.BatchId);
        Assert.Equal(1, result.SavedCount);
        Assert.Equal(1, result.SkippedCount);
        Assert.Equal(101, Assert.Single(result.Skipped).EmpId);

        var assignmentsResponse = await _client.GetAsync(
            $"/api/shift-assignments/batches/{result.BatchId!.Value}/assignments");
        var assignments = await assignmentsResponse.Content
            .ReadFromJsonAsync<List<AssignmentResponse>>();
        Assert.Equal(102, Assert.Single(assignments!).EmpId);
    }

    [Fact]
    public async Task BulkPreview_ReturnsDryRunAndWritesNothing()
    {
        var response = await _client.PostAsJsonAsync("/api/shift-assignments/bulk/preview", new
        {
            shiftId = 1,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101 }
        });

        response.EnsureSuccessStatusCode();
        var preview = await response.Content.ReadFromJsonAsync<PreviewResponse>();
        Assert.NotNull(preview);
        Assert.True(preview!.DryRun);
        Assert.Equal(1, preview.WouldSaveCount);
        Assert.Equal(0, preview.SkippedCount);

        var batchesResponse = await _client.GetAsync("/api/shift-assignments/batches");
        using var batchesJson = JsonDocument.Parse(await batchesResponse.Content.ReadAsStringAsync());
        Assert.Equal(0, batchesJson.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task BulkAssign_InactiveEmployee_Returns400AndCreatesNoBatch()
    {
        await _database.ExecuteAsync(
            """UPDATE "Employees" SET "Status" = 'Inactive' WHERE "Id" = 102;""");

        var response = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 102 }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("inactive", body, StringComparison.OrdinalIgnoreCase);

        var batchesResponse = await _client.GetAsync("/api/shift-assignments/batches");
        using var batchesJson = JsonDocument.Parse(await batchesResponse.Content.ReadAsStringAsync());
        Assert.Equal(0, batchesJson.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task CancelBatch_MarksAssignmentsCancelledAndRetainsRows()
    {
        var assignResponse = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-10-31",
            toDate = "2026-10-31",
            employeeIds = new[] { 101, 102 }
        });
        assignResponse.EnsureSuccessStatusCode();
        var result = await assignResponse.Content.ReadFromJsonAsync<BulkResponse>();

        var cancelResponse = await _client.PatchAsync(
            $"/api/shift-assignments/batches/{result!.BatchId!.Value}/cancel",
            null);

        cancelResponse.EnsureSuccessStatusCode();
        var cancelled = await cancelResponse.Content.ReadFromJsonAsync<BatchResponse>();
        Assert.NotNull(cancelled);
        Assert.Equal("Cancelled", cancelled!.Status);
        Assert.Equal(0, cancelled.AssignmentCount);

        var assignmentsResponse = await _client.GetAsync(
            $"/api/shift-assignments/batches/{result.BatchId!.Value}/assignments");
        var assignments = await assignmentsResponse.Content
            .ReadFromJsonAsync<List<AssignmentResponse>>();
        Assert.Equal(2, assignments!.Count);
        Assert.All(assignments, assignment => Assert.Equal("Cancelled", assignment.Status));
    }

    [Fact]
    public async Task BulkAssign_ToDateBeforeFromDate_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = "2026-11-01",
            toDate = "2026-10-31",
            employeeIds = new[] { 101 }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed record BulkResponse(
        int? BatchId,
        int SavedCount,
        int SkippedCount,
        int TotalEmployees,
        int TotalAssignments,
        List<SkippedResponse> Skipped);

    private sealed record PreviewResponse(
        bool DryRun,
        int WouldSaveCount,
        int SkippedCount,
        List<SkippedResponse> Skipped);

    private sealed record SkippedResponse(
        int EmpId,
        DateTime Date,
        string Reason,
        string Detail);

    private sealed record BatchResponse(int BatchId, int AssignmentCount, string Status);

    private sealed record AssignmentResponse(
        int EmpId,
        DateTime ShiftDate,
        DateTime ShiftStartDt,
        DateTime ShiftEndDt,
        string Status);
}
