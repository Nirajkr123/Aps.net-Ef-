using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ASPCoreWebAPI.Services;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class AttendancePunchApiTests
{
    private const double Latitude = 12.9716;
    private const double Longitude = 77.5946;

    private readonly DatabaseFixture _database;

    public AttendancePunchApiTests(DatabaseFixture database)
    {
        _database = database;
    }

    [Fact]
    public async Task CheckIn_Enforce_OutsideWindow_BlocksAndDoesNotCreateRecord()
    {
        await PrepareEmployeeAsync(mode: "ENFORCE", withShift: true);
        using var factory = FactoryAt(new DateTime(2026, 11, 10, 12, 30, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("checkin_not_open", body.RootElement.GetProperty("code").GetString());
        Assert.Equal(0, await CountAttendanceAsync());
    }

    [Fact]
    public async Task CheckIn_Warn_OutsideWindow_AllowsAndWritesWarningAudit()
    {
        await PrepareEmployeeAsync(mode: "WARN", withShift: true);
        using var factory = FactoryAt(new DateTime(2026, 11, 10, 12, 30, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.False(string.IsNullOrWhiteSpace(body.RootElement.GetProperty("warning").GetString()));

        var attendanceId = body.RootElement.GetProperty("id").GetInt32();
        Assert.Equal(
            1,
            await _database.ScalarAsync<int>(
                @"SELECT COUNT(*)::int FROM audit_logs
                   WHERE action = 'ATTENDANCE_CHECKIN_WARNING' AND entity_id = @AttendanceId",
                new { AttendanceId = attendanceId }));
    }

    [Fact]
    public async Task CheckIn_Off_OutsideWindow_AllowsWithoutWarning()
    {
        await PrepareEmployeeAsync(mode: "OFF", withShift: true);
        using var factory = FactoryAt(new DateTime(2026, 11, 10, 12, 30, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(JsonValueKind.Null, body.RootElement.GetProperty("warning").ValueKind);
    }

    [Fact]
    public async Task CheckIn_At1230Am_UsesPreviousShiftDateAndBlocksDuplicate()
    {
        var assignmentId = await PrepareEmployeeAsync(mode: "ENFORCE", withShift: true);
        using var factory = FactoryAt(new DateTime(2026, 11, 10, 19, 0, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(assignmentId, body.RootElement.GetProperty("shiftAssignmentId").GetInt32());
        Assert.StartsWith(
            "2026-11-10",
            body.RootElement.GetProperty("attendanceDate").GetString());
        Assert.Equal("Late", body.RootElement.GetProperty("status").GetString());
        Assert.Equal(
            new DateTime(2026, 11, 10, 19, 0, 0),
            await _database.ScalarAsync<DateTime>(
                @"SELECT check_in_time FROM attendance WHERE employee_id = 101"));

        var duplicate = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        using var duplicateBody = await ReadJsonAsync(duplicate);
        Assert.Equal("already_checked_in", duplicateBody.RootElement.GetProperty("code").GetString());
        Assert.Equal(1, await CountAttendanceAsync());
    }

    [Fact]
    public async Task CheckIn_WithStaleLegacyOpenAttendance_ClosesItAndCreatesNewRecord()
    {
        var assignmentId = await PrepareEmployeeAsync(mode: "WARN", withShift: true);
        await SeedLegacyOpenAttendanceAsync(
            new DateTime(2026, 11, 3),
            new DateTime(2026, 11, 3, 12, 55, 0));
        using var factory = FactoryAt(new DateTime(2026, 11, 10, 12, 30, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(assignmentId, body.RootElement.GetProperty("shiftAssignmentId").GetInt32());
        Assert.Equal(
            "MissingPunch",
            await _database.ScalarAsync<string>(
                @"SELECT status::text FROM attendance
                   WHERE employee_id = 101 AND attendance_date = DATE '2026-11-03'"));
        Assert.NotNull(await _database.ScalarAsync<DateTime?>(
            @"SELECT missing_punch_detected_at FROM attendance
               WHERE employee_id = 101 AND attendance_date = DATE '2026-11-03'"));
        Assert.Null(await _database.ScalarAsync<DateTime?>(
            @"SELECT check_out_time FROM attendance
               WHERE employee_id = 101 AND attendance_date = DATE '2026-11-03'"));
        Assert.Equal(2, await CountAttendanceAsync());
    }

    [Fact]
    public async Task CheckIn_WithStaleAssignedOpenAttendance_ClosesItAndCreatesNewRecord()
    {
        var assignmentId = await PrepareEmployeeAsync(mode: "WARN", withShift: true);
        var staleAssignmentId = await _database.ScalarAsync<int>(
            """
            INSERT INTO "shift_assignment"
                ("batch_id", "emp_id", "shift_id", "shift_date", "shift_start_dt", "shift_end_dt", "status")
            VALUES
                (NULL, 101, 4, DATE '2026-11-03',
                 TIMESTAMP '2026-11-03 23:00:00',
                 TIMESTAMP '2026-11-04 07:00:00',
                 'Assigned')
            RETURNING id;
            """);
        await SeedOpenAttendanceAsync(
            staleAssignmentId,
            new DateTime(2026, 11, 3),
            new DateTime(2026, 11, 3, 18, 0, 0));
        using var factory = FactoryAt(new DateTime(2026, 11, 10, 12, 30, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(assignmentId, body.RootElement.GetProperty("shiftAssignmentId").GetInt32());
        Assert.Equal(
            "MissingPunch",
            await _database.ScalarAsync<string>(
                @"SELECT status::text FROM attendance WHERE shift_assignment_id = @StaleAssignmentId",
                new { StaleAssignmentId = staleAssignmentId }));
        Assert.NotNull(await _database.ScalarAsync<DateTime?>(
            @"SELECT missing_punch_detected_at FROM attendance WHERE shift_assignment_id = @StaleAssignmentId",
            new { StaleAssignmentId = staleAssignmentId }));
        Assert.NotNull(await _database.ScalarAsync<DateTime?>(
            @"SELECT check_out_time FROM attendance WHERE shift_assignment_id = @StaleAssignmentId",
            new { StaleAssignmentId = staleAssignmentId }));
        Assert.Equal(2, await CountAttendanceAsync());
    }

    [Fact]
    public async Task CheckIn_NoShift_EnforceBlocks()
    {
        await PrepareEmployeeAsync(mode: "ENFORCE", withShift: false);
        using var factory = FactoryAt(new DateTime(2026, 11, 10, 12, 30, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckInAsync(client);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("no_shift_assigned", body.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CheckOut_AfterBuffer_MarksMissedCheckoutAndBlocks()
    {
        var assignmentId = await PrepareEmployeeAsync(mode: "ENFORCE", withShift: true);
        await SeedOpenAttendanceAsync(assignmentId, new DateTime(2026, 11, 10, 17, 30, 0));
        using var factory = FactoryAt(new DateTime(2026, 11, 11, 5, 31, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckOutAsync(client);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("missed_checkout", body.RootElement.GetProperty("code").GetString());
        Assert.NotNull(await _database.ScalarAsync<DateTime?>(
            @"SELECT missing_punch_detected_at FROM attendance WHERE employee_id = 101"));
        Assert.Null(await _database.ScalarAsync<DateTime?>(
            @"SELECT check_out_time FROM attendance WHERE employee_id = 101"));
    }

    [Fact]
    public async Task CheckOut_WithinBuffer_IgnoresEarlyArrivalAndUsesIstHours()
    {
        var assignmentId = await PrepareEmployeeAsync(mode: "ENFORCE", withShift: true);
        await SeedOpenAttendanceAsync(assignmentId, new DateTime(2026, 11, 10, 16, 30, 0));
        using var factory = FactoryAt(new DateTime(2026, 11, 11, 1, 30, 0, DateTimeKind.Utc));
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await PostCheckOutAsync(client);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(8m, body.RootElement.GetProperty("workingHours").GetDecimal());
        Assert.Equal("Present", body.RootElement.GetProperty("status").GetString());
        Assert.Equal(
            new DateTime(2026, 11, 11, 1, 30, 0),
            await _database.ScalarAsync<DateTime>(
                @"SELECT check_out_time FROM attendance WHERE employee_id = 101"));
    }

    private async Task<int> PrepareEmployeeAsync(string mode, bool withShift)
    {
        await _database.ResetAsync();
        await _database.ExecuteAsync(
            """
            INSERT INTO "WorkLocations" ("Name", "Latitude", "Longitude", "RadiusMeters", "IsActive")
            VALUES ('HQ', @Latitude, @Longitude, 1000, TRUE);

            UPDATE attendance_config SET enforcement_mode = @Mode;
            """,
            new { Latitude, Longitude, Mode = mode });

        if (!withShift)
            return 0;

        await _database.ExecuteAsync(
            """
            INSERT INTO "shift"
                ("shift_id", "shift_name", "start_time", "duration_hours", "end_time", "crosses_midnight", "is_active")
            VALUES
                (4, 'Late Night Test', TIME '23:00', 8, TIME '07:00', TRUE, TRUE);

            SELECT setval(pg_get_serial_sequence('"shift"', 'shift_id'),
                          (SELECT MAX(shift_id) FROM "shift"), TRUE);
            """);

        return await _database.ScalarAsync<int>(
            """
            INSERT INTO "shift_assignment"
                ("batch_id", "emp_id", "shift_id", "shift_date", "shift_start_dt", "shift_end_dt", "status")
            VALUES
                (NULL, 101, 4, DATE '2026-11-10',
                 TIMESTAMP '2026-11-10 23:00:00',
                 TIMESTAMP '2026-11-11 07:00:00',
                 'Assigned')
            RETURNING id;
            """);
    }

    private Task SeedOpenAttendanceAsync(int assignmentId, DateTime checkInUtc)
    {
        return SeedOpenAttendanceAsync(assignmentId, new DateTime(2026, 11, 10), checkInUtc);
    }

    private async Task SeedOpenAttendanceAsync(
        int assignmentId,
        DateTime attendanceDate,
        DateTime checkInUtc)
    {
        await _database.ExecuteAsync(
            """
            INSERT INTO attendance
                (employee_id, attendance_date, shift_assignment_id, check_in_time, status, is_late, source)
            VALUES
                (101, @AttendanceDate::date, @AssignmentId, @CheckInUtc, 'Present', FALSE, 'SELF');
            """,
            new
            {
                AttendanceDate = attendanceDate.Date,
                AssignmentId = assignmentId,
                CheckInUtc = checkInUtc
            });
    }

    private async Task SeedLegacyOpenAttendanceAsync(DateTime attendanceDate, DateTime checkInUtc)
    {
        await _database.ExecuteAsync(
            """
            INSERT INTO attendance
                (employee_id, attendance_date, shift_assignment_id, check_in_time, status, is_late, source)
            VALUES
                (101, @AttendanceDate::date, NULL, @CheckInUtc, 'Present', FALSE, 'SELF');
            """,
            new
            {
                AttendanceDate = attendanceDate.Date,
                CheckInUtc = checkInUtc
            });
    }

    private async Task<int> CountAttendanceAsync()
    {
        return await _database.ScalarAsync<int>(
            @"SELECT COUNT(*)::int FROM attendance WHERE employee_id = 101");
    }

    private ShiftApiFactory FactoryAt(DateTime utcNow)
    {
        return new ShiftApiFactory(_database, new FixedClock(utcNow));
    }

    private static Task<HttpResponseMessage> PostCheckInAsync(HttpClient client)
    {
        return client.PostAsJsonAsync("/api/attendance/checkin", new
        {
            latitude = Latitude,
            longitude = Longitude,
            accuracy = 5
        });
    }

    private static Task<HttpResponseMessage> PostCheckOutAsync(HttpClient client)
    {
        return client.PostAsJsonAsync("/api/attendance/checkout", new
        {
            latitude = Latitude,
            longitude = Longitude,
            accuracy = 5
        });
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
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
