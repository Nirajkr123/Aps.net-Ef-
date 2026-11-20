using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class AttendanceOverrideApiTests
{
    private readonly DatabaseFixture _database;

    public AttendanceOverrideApiTests(DatabaseFixture database)
    {
        _database = database;
    }

    [Fact]
    public async Task Override_ConvertsIstTimes_RebuildsHours_AndWritesAudit()
    {
        var attendanceId = await PrepareAttendanceAsync();
        using var factory = new ShiftApiFactory(_database);
        using var client = factory.CreateAuthenticatedClient("HR", 2);

        var response = await client.PutAsJsonAsync(
            $"/api/attendance/{attendanceId}/override",
            new
            {
                checkInTime = "2026-10-31T07:00:00",
                checkOutTime = "2026-10-31T17:30:00",
                status = "Present",
                reason = "Biometric device was offline"
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = body.RootElement;

        Assert.Equal("ADMIN_OVERRIDE", root.GetProperty("source").GetString());
        Assert.Equal(10.5m, root.GetProperty("workingHours").GetDecimal());
        Assert.True(root.GetProperty("isLate").GetBoolean());
        Assert.StartsWith("2026-10-31T01:30:00", root.GetProperty("checkInTime").GetString());
        Assert.StartsWith("2026-10-31T12:00:00", root.GetProperty("checkOutTime").GetString());
        Assert.Equal(
            new DateTime(2026, 10, 31, 1, 30, 0),
            await _database.ScalarAsync<DateTime>(
                "SELECT check_in_time FROM attendance WHERE id = @Id",
                new { Id = attendanceId }));
        Assert.Equal(
            new DateTime(2026, 10, 31, 12, 0, 0),
            await _database.ScalarAsync<DateTime>(
                "SELECT check_out_time FROM attendance WHERE id = @Id",
                new { Id = attendanceId }));
        Assert.Null(await _database.ScalarAsync<DateTime?>(
            "SELECT missing_punch_detected_at FROM attendance WHERE id = @Id",
            new { Id = attendanceId }));
        Assert.Equal(
            "Biometric device was offline",
            await _database.ScalarAsync<string>(
                "SELECT reason FROM audit_logs WHERE action = 'ATTENDANCE_ADMIN_OVERRIDE'"));
        Assert.Equal(
            "ADMIN",
            await _database.ScalarAsync<string>(
                "SELECT source FROM audit_logs WHERE action = 'ATTENDANCE_ADMIN_OVERRIDE'"));
        Assert.NotNull(await _database.ScalarAsync<string>(
            "SELECT \"before\"::text FROM audit_logs WHERE action = 'ATTENDANCE_ADMIN_OVERRIDE'"));
        Assert.NotNull(await _database.ScalarAsync<string>(
            "SELECT \"after\"::text FROM audit_logs WHERE action = 'ATTENDANCE_ADMIN_OVERRIDE'"));
    }

    [Fact]
    public async Task Override_RequiresReasonAndValidTimeRange()
    {
        var attendanceId = await PrepareAttendanceAsync();
        using var factory = new ShiftApiFactory(_database);
        using var client = factory.CreateAuthenticatedClient("OWNER", 1);

        var missingReason = await client.PutAsJsonAsync(
            $"/api/attendance/{attendanceId}/override",
            new
            {
                checkInTime = "2026-10-31T07:00:00",
                status = "Present",
                reason = " "
            });

        Assert.Equal(HttpStatusCode.BadRequest, missingReason.StatusCode);
        using var missingReasonBody = JsonDocument.Parse(
            await missingReason.Content.ReadAsStringAsync());
        Assert.Equal(
            "reason_required",
            missingReasonBody.RootElement.GetProperty("code").GetString());

        var invalidRange = await client.PutAsJsonAsync(
            $"/api/attendance/{attendanceId}/override",
            new
            {
                checkInTime = "2026-10-31T18:00:00",
                checkOutTime = "2026-10-31T09:00:00",
                status = "Present",
                reason = "Correcting punch times"
            });

        Assert.Equal(HttpStatusCode.BadRequest, invalidRange.StatusCode);
        using var invalidRangeBody = JsonDocument.Parse(
            await invalidRange.Content.ReadAsStringAsync());
        Assert.Equal(
            "invalid_time_range",
            invalidRangeBody.RootElement.GetProperty("code").GetString());
        Assert.Equal(
            0,
            await _database.ScalarAsync<int>(
                "SELECT COUNT(*)::int FROM audit_logs WHERE action = 'ATTENDANCE_ADMIN_OVERRIDE'"));
    }

    [Fact]
    public async Task Override_RejectsEmployeeRole()
    {
        var attendanceId = await PrepareAttendanceAsync();
        using var factory = new ShiftApiFactory(_database);
        using var client = factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await client.PutAsJsonAsync(
            $"/api/attendance/{attendanceId}/override",
            new
            {
                status = "Present",
                reason = "Employee attempted override"
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<int> PrepareAttendanceAsync()
    {
        await _database.ResetAsync();

        var assignmentId = await _database.ScalarAsync<int>(
            """
            INSERT INTO shift_assignment
                (batch_id, emp_id, shift_id, shift_date, shift_start_dt, shift_end_dt, status)
            VALUES
                (NULL, 101, 1, DATE '2026-10-31',
                 TIMESTAMP '2026-10-31 06:00:00',
                 TIMESTAMP '2026-10-31 16:00:00',
                 'Assigned')
            RETURNING id;
            """);

        return await _database.ScalarAsync<int>(
            """
            INSERT INTO attendance
                (employee_id, attendance_date, shift_assignment_id, check_in_time,
                 status, is_late, source, missing_punch_detected_at)
            VALUES
                (101, DATE '2026-10-31', @AssignmentId, TIMESTAMP '2026-10-31 00:05:00',
                 'Present', FALSE, 'SELF', TIMESTAMP '2026-10-31 12:00:00')
            RETURNING id;
            """,
            new { AssignmentId = assignmentId });
    }
}
