using System.Net.Http.Json;
using System.Text.Json;
using ASPCoreWebAPI.Services;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public sealed class ShiftAcceptanceScenarioTests : IAsyncLifetime
{
    private const double Latitude = 12.9716;
    private const double Longitude = 77.5946;
    private readonly DatabaseFixture _database;

    public ShiftAcceptanceScenarioTests(DatabaseFixture database)
    {
        _database = database;
    }

    public async Task InitializeAsync()
    {
        await _database.ResetAsync();
        await _database.ExecuteAsync(
            """
            INSERT INTO "WorkLocations" ("Name", "Latitude", "Longitude", "RadiusMeters", "IsActive")
            VALUES ('HQ', @Latitude, @Longitude, 1000, TRUE);

            UPDATE attendance_config
               SET enforcement_mode = 'ENFORCE',
                   punch_early_minutes = 30,
                   punch_late_minutes = 120,
                   late_grace_minutes = 10,
                   checkout_buffer_minutes = 240;

            UPDATE "shift" SET
                shift_name = CASE shift_id
                    WHEN 1 THEN 'Morning'
                    WHEN 2 THEN 'Second'
                    WHEN 3 THEN 'Night'
                END,
                start_time = CASE shift_id
                    WHEN 1 THEN TIME '06:00'
                    WHEN 2 THEN TIME '14:00'
                    WHEN 3 THEN TIME '22:00'
                END,
                duration_hours = 8,
                end_time = CASE shift_id
                    WHEN 1 THEN TIME '14:00'
                    WHEN 2 THEN TIME '22:00'
                    WHEN 3 THEN TIME '06:00'
                END,
                crosses_midnight = shift_id = 3,
                is_active = TRUE;

            INSERT INTO "shift_assignment"
                (batch_id, emp_id, shift_id, shift_date, shift_start_dt, shift_end_dt, status)
            VALUES
                (NULL, 101, 1, DATE '2026-11-18', TIMESTAMP '2026-11-18 06:00', TIMESTAMP '2026-11-18 14:00', 'Assigned'),
                (NULL, 102, 2, DATE '2026-11-18', TIMESTAMP '2026-11-18 14:00', TIMESTAMP '2026-11-18 22:00', 'Assigned'),
                (NULL, 103, 3, DATE '2026-11-18', TIMESTAMP '2026-11-18 22:00', TIMESTAMP '2026-11-19 06:00', 'Assigned');
            """,
            new { Latitude, Longitude });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Theory]
    [InlineData(2026, 11, 18, 5, 40, true, "OPEN")]
    [InlineData(2026, 11, 18, 15, 0, false, "CHECK_IN_CLOSED")]
    public async Task Ram_MorningWindow_MatchesAcceptanceTimes(
        int year,
        int month,
        int day,
        int hour,
        int minute,
        bool canCheckIn,
        string windowState)
    {
        using var factory = FactoryAtIst(year, month, day, hour, minute);
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var state = await GetTodayStateAsync(client);

        Assert.Equal("Morning", state.GetProperty("shift").GetProperty("shiftName").GetString());
        Assert.Equal(canCheckIn, state.GetProperty("canCheckIn").GetBoolean());
        Assert.Equal(windowState, state.GetProperty("windowState").GetString());
    }

    [Theory]
    [InlineData(10, 0, false, "BEFORE_WINDOW")]
    [InlineData(14, 5, true, "OPEN")]
    [InlineData(14, 40, true, "OPEN")]
    [InlineData(16, 30, false, "CHECK_IN_CLOSED")]
    public async Task Shyam_SecondWindow_MatchesAcceptanceTimes(
        int hour,
        int minute,
        bool canCheckIn,
        string windowState)
    {
        using var factory = FactoryAtIst(2026, 11, 18, hour, minute);
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 102);

        var state = await GetTodayStateAsync(client);

        Assert.Equal("Second", state.GetProperty("shift").GetProperty("shiftName").GetString());
        Assert.Equal(canCheckIn, state.GetProperty("canCheckIn").GetBoolean());
        Assert.Equal(windowState, state.GetProperty("windowState").GetString());
    }

    [Theory]
    [InlineData(14, 5, false, "Present")]
    [InlineData(14, 40, true, "Late")]
    public async Task Shyam_CheckIn_UsesTenMinuteGrace(
        int hour,
        int minute,
        bool isLate,
        string status)
    {
        using var factory = FactoryAtIst(2026, 11, 18, hour, minute);
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 102);

        var response = await PostPunchAsync(client, "/api/attendance/checkin");
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.Equal(isLate, body.RootElement.GetProperty("isLate").GetBoolean());
        Assert.Equal(status, body.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Mohan_NightCheckInAndNextDayCheckout_KeepPreviousShiftDate()
    {
        using (var checkInFactory = FactoryAtIst(2026, 11, 18, 22, 5))
        using (var checkInClient = checkInFactory.CreateAuthenticatedClient("EMPLOYEE", 3, 103))
        {
            var checkIn = await PostPunchAsync(checkInClient, "/api/attendance/checkin");
            checkIn.EnsureSuccessStatusCode();
        }

        using (var checkOutFactory = FactoryAtIst(2026, 11, 19, 1, 0))
        using (var checkOutClient = checkOutFactory.CreateAuthenticatedClient("EMPLOYEE", 3, 103))
        {
            var checkOut = await PostPunchAsync(checkOutClient, "/api/attendance/checkout");
            checkOut.EnsureSuccessStatusCode();
        }

        Assert.Equal(
            new DateOnly(2026, 11, 18),
            await _database.ScalarAsync<DateOnly>(
                "SELECT attendance_date FROM attendance WHERE employee_id = 103"));
        Assert.NotNull(await _database.ScalarAsync<DateTime?>(
            "SELECT check_out_time FROM attendance WHERE employee_id = 103"));
        Assert.Equal(3, await _database.ScalarAsync<int>(
            """
            SELECT sa.shift_id
              FROM attendance a
              JOIN shift_assignment sa ON sa.id = a.shift_assignment_id
             WHERE a.employee_id = 103
            """));
    }

    private ShiftApiFactory FactoryAtIst(int year, int month, int day, int hour, int minute)
    {
        var local = new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Unspecified);
        var utc = TimeZoneInfo.ConvertTimeToUtc(
            local,
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        return new ShiftApiFactory(_database, new FixedClock(utc));
    }

    private static async Task<JsonElement> GetTodayStateAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/attendance/today-state");
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.Clone();
    }

    private static Task<HttpResponseMessage> PostPunchAsync(HttpClient client, string endpoint)
    {
        return client.PostAsJsonAsync(endpoint, new
        {
            latitude = Latitude,
            longitude = Longitude,
            accuracy = 5
        });
    }

    private sealed class FixedClock : IClock
    {
        public FixedClock(DateTime utcNow) => UtcNow = utcNow;
        public DateTime UtcNow { get; }
    }
}
