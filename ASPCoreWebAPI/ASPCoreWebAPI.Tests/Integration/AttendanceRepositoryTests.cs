using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class AttendanceRepositoryTests
{
    private readonly DatabaseFixture _database;
    private readonly AttendanceRepository _repository;

    public AttendanceRepositoryTests(DatabaseFixture database)
    {
        _database = database;
        _repository = new AttendanceRepository(database.DataSource);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsAssignmentMissingPunchAndSource()
    {
        await _database.ResetAsync();

        var batchId = await _database.ScalarAsync<int>(
            """
            INSERT INTO assignment_batch
                (shift_id, from_date, to_date, total_employees, created_by)
            VALUES
                (1, DATE '2026-10-31', DATE '2026-10-31', 1, 1)
            RETURNING batch_id;
            """);

        var assignmentId = await _database.ScalarAsync<int>(
            """
            INSERT INTO shift_assignment
                (batch_id, emp_id, shift_id, shift_date, shift_start_dt, shift_end_dt)
            VALUES
                (@BatchId, 101, 1, DATE '2026-10-31',
                 TIMESTAMP '2026-10-31 06:00', TIMESTAMP '2026-10-31 16:00')
            RETURNING id;
            """,
            new { BatchId = batchId });

        var attendanceId = await _database.ScalarAsync<int>(
            """
            INSERT INTO attendance
                (employee_id, attendance_date, shift_assignment_id, check_in_time,
                 status, source, missing_punch_detected_at)
            VALUES
                (101, DATE '2026-10-31', @AssignmentId, TIMESTAMP '2026-10-31 06:05',
                 'Present', 'ADMIN_OVERRIDE', TIMESTAMP '2026-10-31 20:00')
            RETURNING id;
            """,
            new { AssignmentId = assignmentId });

        var attendance = await _repository.GetByIdAsync(attendanceId);

        Assert.NotNull(attendance);
        Assert.Equal(assignmentId, attendance!.ShiftAssignmentId);
        Assert.Equal("ADMIN_OVERRIDE", attendance.Source);
        Assert.Equal(new DateTime(2026, 10, 31, 20, 0, 0), attendance.MissingPunchDetectedAt);
        Assert.Equal("Shift A", attendance.ShiftName);
        Assert.Equal(new DateTime(2026, 10, 31, 6, 0, 0), attendance.ShiftStartDt);
        Assert.Equal(new DateTime(2026, 10, 31, 16, 0, 0), attendance.ShiftEndDt);
        Assert.False(attendance.ShiftCrossesMidnight);
    }

    [Fact]
    public async Task GetByIdAsync_DefaultsLegacySourceToSelf()
    {
        await _database.ResetAsync();

        var attendanceId = await _database.ScalarAsync<int>(
            """
            INSERT INTO attendance
                (employee_id, attendance_date, check_in_time, status)
            VALUES
                (101, DATE '2026-10-31', TIMESTAMP '2026-10-31 06:05', 'Present')
            RETURNING id;
            """);

        var attendance = await _repository.GetByIdAsync(attendanceId);

        Assert.NotNull(attendance);
        Assert.Equal("SELF", attendance!.Source);
        Assert.Null(attendance.ShiftAssignmentId);
        Assert.Null(attendance.MissingPunchDetectedAt);
    }
}
