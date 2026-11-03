using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class ShiftRepositoryTests
{
    private readonly DatabaseFixture _database;
    private readonly ShiftRepository _repository;

    public ShiftRepositoryTests(DatabaseFixture database)
    {
        _database = database;
        _repository = new ShiftRepository(database.DataSource);
    }

    [Fact]
    public async Task BulkAssign_ShiftCOnOctober31_CreatesCrossMidnightWindow()
    {
        await _database.ResetAsync();

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 3,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.NotNull(result.BatchId);
        var assignment = Assert.Single(
            await _repository.GetBatchAssignmentsAsync(result.BatchId!.Value));

        Assert.Equal(new DateTime(2026, 10, 31, 20, 0, 0), assignment.ShiftStartDt);
        Assert.Equal(new DateTime(2026, 11, 1, 6, 0, 0), assignment.ShiftEndDt);
        Assert.Equal(new DateTime(2026, 10, 31), assignment.ShiftDate);
    }

    [Fact]
    public async Task BulkAssign_CrossesMonthAndYear_CreatesExpectedWindows()
    {
        await _database.ResetAsync();

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 3,
            FromDate = new DateTime(2026, 12, 31),
            ToDate = new DateTime(2027, 1, 1),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.NotNull(result.BatchId);
        var assignments = await _repository.GetBatchAssignmentsAsync(result.BatchId!.Value);

        Assert.Equal(2, assignments.Count);
        Assert.Equal(new DateTime(2027, 1, 1, 6, 0, 0), assignments[0].ShiftEndDt);
        Assert.Equal(new DateTime(2027, 1, 2, 6, 0, 0), assignments[1].ShiftEndDt);
    }

    [Fact]
    public async Task PreviewBulkAssign_DoesNotWriteAndReportsConflicts()
    {
        await _database.ResetAsync();
        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var preview = await _repository.PreviewBulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 2,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101, 102]
        });

        Assert.True(preview.DryRun);
        Assert.Equal(1, preview.WouldSaveCount);
        Assert.Equal(1, preview.SkippedCount);
        Assert.Equal(101, Assert.Single(preview.Skipped).EmpId);
        Assert.Equal(1, await CountTableAsync("assignment_batch"));
        Assert.Equal(1, await CountTableAsync("shift_assignment"));
    }

    [Fact]
    public async Task BulkAssign_PartialConflict_SavesOtherEmployee()
    {
        await _database.ResetAsync();
        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 2,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101, 102]
        }, createdBy: 1);

        Assert.NotNull(result.BatchId);
        Assert.Equal(1, result.SavedCount);
        Assert.Equal(1, result.SkippedCount);
        Assert.Equal(101, Assert.Single(result.Skipped).EmpId);
        Assert.Equal(ShiftConflictReasons.Overlap, result.Skipped[0].Reason);

        var assignments = await _repository.GetBatchAssignmentsAsync(result.BatchId!.Value);
        Assert.Equal(102, Assert.Single(assignments).EmpId);
        Assert.Equal(2, await CountTableAsync("assignment_batch"));
        Assert.Equal(2, await CountTableAsync("shift_assignment"));
    }

    [Fact]
    public async Task BulkAssign_StrictConflict_SavesNothing()
    {
        await _database.ResetAsync();
        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 2,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101, 102],
            Strict = true
        }, createdBy: 1);

        Assert.True(result.StrictBlocked);
        Assert.Null(result.BatchId);
        Assert.Equal(0, result.SavedCount);
        Assert.Equal(1, result.SkippedCount);
        Assert.Equal(1, await CountTableAsync("assignment_batch"));
        Assert.Equal(1, await CountTableAsync("shift_assignment"));
    }

    [Fact]
    public async Task BulkAssign_InactiveEmployee_ThrowsAndCreatesNothing()
    {
        await _database.ResetAsync();
        await _database.ExecuteAsync(
            """UPDATE "Employees" SET "Status" = 'Inactive' WHERE "Id" = 102;""");

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _repository.BulkAssignAsync(new BulkAssignRequest
            {
                ShiftId = 1,
                FromDate = new DateTime(2026, 10, 31),
                ToDate = new DateTime(2026, 10, 31),
                EmployeeIds = [102]
            }, createdBy: 1));

        Assert.Contains("inactive", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await CountTableAsync("assignment_batch"));
    }

    [Fact]
    public async Task BulkAssign_InactiveShift_ThrowsAndCreatesNothing()
    {
        await _database.ResetAsync();
        await _database.ExecuteAsync(
            """UPDATE "shift" SET is_active = FALSE WHERE shift_id = 1;""");

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _repository.BulkAssignAsync(new BulkAssignRequest
            {
                ShiftId = 1,
                FromDate = new DateTime(2026, 10, 31),
                ToDate = new DateTime(2026, 10, 31),
                EmployeeIds = [101]
            }, createdBy: 1));

        Assert.Contains("inactive", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await CountTableAsync("assignment_batch"));
    }

    [Fact]
    public async Task CancelBatch_KeepsRowsButMarksThemCancelled()
    {
        await _database.ResetAsync();
        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101, 102]
        }, createdBy: 1);

        Assert.NotNull(result.BatchId);
        var cancelled = await _repository.CancelBatchAsync(result.BatchId!.Value);

        Assert.NotNull(cancelled);
        Assert.Equal("Cancelled", cancelled!.Status);
        Assert.Equal(0, cancelled.AssignmentCount);
        Assert.Equal(2, await CountTableAsync("shift_assignment"));
        Assert.Equal(2, await CountAsync(
            """SELECT COUNT(*) FROM "shift_assignment" WHERE status = 'Cancelled';"""));
    }

    [Fact]
    public async Task BulkAssign_AfterCancel_PreservesCancelledRowsAndCreatesNewActive()
    {
        await _database.ResetAsync();
        var first = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);
        Assert.NotNull(first.BatchId);
        await _repository.CancelBatchAsync(first.BatchId!.Value);

        var second = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.NotNull(second.BatchId);
        Assert.Equal(1, second.SavedCount);
        Assert.Equal(2, await CountTableAsync("assignment_batch"));
        Assert.Equal(2, await CountTableAsync("shift_assignment"));
        Assert.Equal(1, await CountAsync(
            """SELECT COUNT(*) FROM "shift_assignment" WHERE status = 'Assigned';"""));
        Assert.Equal(1, await CountAsync(
            """SELECT COUNT(*) FROM "shift_assignment" WHERE status = 'Cancelled';"""));
        Assert.Single(await _repository.GetBatchAssignmentsAsync(second.BatchId!.Value));
    }

    [Fact]
    public async Task BulkAssign_DatabaseFailureDuringAssignmentInsert_RollsBackBatch()
    {
        await _database.ResetAsync();
        await _database.ExecuteAsync(
            """INSERT INTO "test_fail_emp" (emp_id) VALUES (101);""");

        await Assert.ThrowsAnyAsync<Exception>(() =>
            _repository.BulkAssignAsync(new BulkAssignRequest
            {
                ShiftId = 1,
                FromDate = new DateTime(2026, 10, 31),
                ToDate = new DateTime(2026, 10, 31),
                EmployeeIds = [101]
            }, createdBy: 1));

        Assert.Equal(0, await CountTableAsync("assignment_batch"));
        Assert.Equal(0, await CountTableAsync("shift_assignment"));
    }

    [Fact]
    public async Task BulkAssign_CrossMidnightOverlap_IsSkipped()
    {
        await _database.ResetAsync();
        var earlyShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Early Shift",
            StartTime = "05:00",
            DurationHours = 10
        });

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 3,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = earlyShift.ShiftId,
            FromDate = new DateTime(2026, 11, 1),
            ToDate = new DateTime(2026, 11, 1),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.Null(result.BatchId);
        Assert.Equal(0, result.SavedCount);
        Assert.Equal(ShiftConflictReasons.Overlap, Assert.Single(result.Skipped).Reason);
        Assert.Equal(1, await CountTableAsync("shift_assignment"));
    }

    [Fact]
    public async Task BulkAssign_CrossMidnightRestGap_IsSkipped()
    {
        await _database.ResetAsync();

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 3,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 11, 1),
            ToDate = new DateTime(2026, 11, 1),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.Null(result.BatchId);
        Assert.Equal(0, result.SavedCount);
        Assert.Equal(ShiftConflictReasons.RestGap, Assert.Single(result.Skipped).Reason);
    }

    [Fact]
    public async Task BulkAssign_EightHourGapAfterCrossMidnight_IsAccepted()
    {
        await _database.ResetAsync();
        var lateShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Late Shift",
            StartTime = "14:00",
            DurationHours = 10
        });

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 3,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = lateShift.ShiftId,
            FromDate = new DateTime(2026, 11, 1),
            ToDate = new DateTime(2026, 11, 1),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.NotNull(result.BatchId);
        Assert.Equal(1, result.SavedCount);
        Assert.Empty(result.Skipped);
    }

    [Fact]
    public async Task BulkAssign_ExtendedPreviousDuty_UsesExtendedRest()
    {
        await _database.ResetAsync();
        await InsertConfigVersionAsync(
            new DateTime(2026, 10, 30),
            minRest: 480,
            extendedRest: 600);
        var longShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Long Night",
            StartTime = "19:00",
            DurationHours = 11
        });
        var lateShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Late Shift",
            StartTime = "14:00",
            DurationHours = 10
        });

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = longShift.ShiftId,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = lateShift.ShiftId,
            FromDate = new DateTime(2026, 11, 1),
            ToDate = new DateTime(2026, 11, 1),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.Null(result.BatchId);
        Assert.Equal(ShiftConflictReasons.RestGap, Assert.Single(result.Skipped).Reason);
    }

    [Fact]
    public async Task BulkAssign_SameDayGap_UsesConfiguredGap()
    {
        await _database.ResetAsync();
        await InsertConfigVersionAsync(
            new DateTime(2026, 10, 1),
            minGap: 240,
            minRest: 0,
            extendedRest: 0);
        var eveningShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Evening Shift",
            StartTime = "18:00",
            DurationHours = 10
        });

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = eveningShift.ShiftId,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.Null(result.BatchId);
        Assert.Equal(ShiftConflictReasons.SameDayGap, Assert.Single(result.Skipped).Reason);
    }

    [Fact]
    public async Task BulkAssign_MaxHoursPerDay_IsSkipped()
    {
        await _database.ResetAsync();
        await InsertConfigVersionAsync(
            new DateTime(2026, 10, 1),
            minGap: 0,
            minRest: 0,
            extendedRest: 0,
            maxHoursPerDay: 20);
        var longShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Long Shift",
            StartTime = "00:00",
            DurationHours = 11
        });

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = longShift.ShiftId,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 2,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.Null(result.BatchId);
        Assert.Equal(ShiftConflictReasons.MaxHoursPerDay, Assert.Single(result.Skipped).Reason);
    }

    [Fact]
    public async Task BulkAssign_MaxExtendedPerWeek_IsSkipped()
    {
        await _database.ResetAsync();
        await InsertConfigVersionAsync(
            new DateTime(2026, 10, 1),
            minGap: 0,
            minRest: 0,
            extendedRest: 0,
            maxExtendedPerWeek: 1);
        var longShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Long Shift",
            StartTime = "00:00",
            DurationHours = 11
        });

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = longShift.ShiftId,
            FromDate = new DateTime(2026, 10, 26),
            ToDate = new DateTime(2026, 10, 26),
            EmployeeIds = [101]
        }, createdBy: 1);

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = longShift.ShiftId,
            FromDate = new DateTime(2026, 10, 27),
            ToDate = new DateTime(2026, 10, 27),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.Null(result.BatchId);
        Assert.Equal(ShiftConflictReasons.MaxExtendedPerWeek, Assert.Single(result.Skipped).Reason);
    }

    [Fact]
    public async Task BulkAssign_ActualAttendanceHours_UsedBeforePlanned()
    {
        await _database.ResetAsync();
        await InsertConfigVersionAsync(
            new DateTime(2026, 10, 30),
            minRest: 480,
            extendedRest: 600);
        var lateShift = await _repository.CreateAsync(new ShiftRequest
        {
            ShiftName = "Late Shift",
            StartTime = "01:00",
            DurationHours = 10
        });

        await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = 1,
            FromDate = new DateTime(2026, 10, 31),
            ToDate = new DateTime(2026, 10, 31),
            EmployeeIds = [101]
        }, createdBy: 1);

        var assignmentId = await _database.ScalarAsync<int>(
            """SELECT id FROM "shift_assignment" WHERE emp_id = 101;""");
        await _database.ExecuteAsync(
            """
            INSERT INTO attendance
                (employee_id, attendance_date, shift_assignment_id, check_in_time,
                 check_out_time, working_hours, status)
            VALUES
                (101, DATE '2026-10-31', @AssignmentId, TIMESTAMP '2026-10-31 06:00',
                 TIMESTAMP '2026-10-31 17:00', 11, 'Present');
            """,
            new { AssignmentId = assignmentId });

        var result = await _repository.BulkAssignAsync(new BulkAssignRequest
        {
            ShiftId = lateShift.ShiftId,
            FromDate = new DateTime(2026, 11, 1),
            ToDate = new DateTime(2026, 11, 1),
            EmployeeIds = [101]
        }, createdBy: 1);

        Assert.Null(result.BatchId);
        Assert.Equal(ShiftConflictReasons.RestGap, Assert.Single(result.Skipped).Reason);
    }

    private Task InsertConfigVersionAsync(
        DateTime effectiveFrom,
        int minGap = 240,
        int minRest = 480,
        int extendedRest = 480,
        int maxExtendedPerWeek = 3,
        decimal maxHoursPerDay = 20,
        decimal standardHours = 10)
    {
        return _database.ExecuteAsync(
            """
            INSERT INTO attendance_config
                (effective_from, standard_hours, max_hours_per_day, min_gap_same_day_minutes,
                 min_rest_normal_minutes, rest_after_extended_minutes, max_extended_per_week,
                 punch_early_minutes, punch_late_minutes, late_grace_minutes,
                 unpaid_break_minutes, overtime_multiplier)
            VALUES
                (@EffectiveFrom::date, @StandardHours, @MaxHoursPerDay, @MinGap,
                 @MinRest, @ExtendedRest, @MaxExtendedPerWeek,
                 60, 120, 15, 0, 1.50);
            """,
            new
            {
                EffectiveFrom = effectiveFrom.Date,
                StandardHours = standardHours,
                MaxHoursPerDay = maxHoursPerDay,
                MinGap = minGap,
                MinRest = minRest,
                ExtendedRest = extendedRest,
                MaxExtendedPerWeek = maxExtendedPerWeek
            });
    }

    private Task<long> CountTableAsync(string table) =>
        CountAsync($"SELECT COUNT(*) FROM \"{table}\";");

    private async Task<long> CountAsync(string sql, object? parameters = null) =>
        await _database.ScalarAsync<long>(sql, parameters);
}
