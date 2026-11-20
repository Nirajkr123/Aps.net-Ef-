using System.Text.Json;
using ASPCoreWebAPI.Services;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class AttendanceTodayStateApiTests
{
    private readonly DatabaseFixture _database;

    public AttendanceTodayStateApiTests(DatabaseFixture database)
    {
        _database = database;
    }

    [Fact]
    public async Task TodayState_ReturnsNightShiftAndIstServerTime()
    {
        await _database.ResetAsync();
        await _database.ExecuteAsync(
            """
            INSERT INTO "shift"
                ("shift_id", "shift_name", "start_time", "duration_hours", "end_time", "crosses_midnight", "is_active")
            VALUES
                (4, 'Late Night Test', TIME '23:00', 8, TIME '07:00', TRUE, TRUE);

            SELECT setval(pg_get_serial_sequence('"shift"', 'shift_id'),
                          (SELECT MAX(shift_id) FROM "shift"), TRUE);

            INSERT INTO "shift_assignment"
                ("batch_id", "emp_id", "shift_id", "shift_date", "shift_start_dt", "shift_end_dt", "status")
            VALUES
                (NULL, 101, 4, DATE '2026-11-10',
                 TIMESTAMP '2026-11-10 23:00:00',
                 TIMESTAMP '2026-11-11 07:00:00',
                 'Assigned');
            """);

        using var factory = new ShiftApiFactory(
            _database,
            new FixedClock(new DateTime(2026, 11, 10, 18, 0, 0, DateTimeKind.Utc)));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await client.GetAsync("/api/attendance/today-state");

        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.Equal("2026-11-10T23:30:00+05:30", root.GetProperty("serverNow").GetString());
        Assert.Equal("OPEN", root.GetProperty("windowState").GetString());
        Assert.Equal("Late Night Test", root.GetProperty("shift").GetProperty("shiftName").GetString());
        Assert.Equal("2026-11-10", root.GetProperty("shift").GetProperty("shiftDate").GetString());
        Assert.True(root.GetProperty("canCheckIn").GetBoolean());
    }

    [Fact]
    public async Task TodayState_WithoutEmployeeProfile_ReturnsBadRequest()
    {
        await _database.ResetAsync();
        using var factory = new ShiftApiFactory(_database);
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3);

        var response = await client.GetAsync("/api/attendance/today-state");

        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed class FixedClock : IClock
    {
        public FixedClock(DateTime utcNow)
        {
            UtcNow = utcNow;
        }

        public DateTime UtcNow { get; }
    }
}
