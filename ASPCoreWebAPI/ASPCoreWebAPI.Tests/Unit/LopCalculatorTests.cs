using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Services;

namespace ASPCoreWebAPI.Tests.Unit;

public class LopCalculatorTests
{
    private static readonly DateTime JoinedLongAgo = new(2020, 1, 1);

    [Fact]
    public void Calculate_CountsAbsentAndHalfDay()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            new[]
            {
                Attendance(2026, 4, 1, "Absent"),
                Attendance(2026, 4, 2, "Half-day"),
                Attendance(2026, 4, 3, "Present")
            },
            Array.Empty<Leave>(),
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 3));

        Assert.Equal(1.5m, result.LopDays);
        Assert.Equal(30, result.DaysInMonth);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Calculate_CountsMissingAttendanceOnWorkingDaysAsLop()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            Array.Empty<Attendance>(),
            Array.Empty<Leave>(),
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 2));

        Assert.Equal(2m, result.LopDays);
        Assert.Equal(2, result.Warnings.Count);
        Assert.All(result.Warnings, w =>
            Assert.Contains("No attendance record", w, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Calculate_SkipsWeeklyOffsAndHolidays()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            Array.Empty<Attendance>(),
            Array.Empty<Leave>(),
            new[] { new DateTime(2026, 4, 3) },
            new[] { DayOfWeek.Sunday },
            new DateTime(2026, 4, 5));

        Assert.Equal(3m, result.LopDays);
        Assert.Equal(3, result.Warnings.Count);
    }

    [Fact]
    public void Calculate_ApprovedLeaveCountsAsZero()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            Array.Empty<Attendance>(),
            new[] { Leave(2026, 4, 1, 2026, 4, 2, LeaveStatuses.Approved) },
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 2));

        Assert.Equal(0m, result.LopDays);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Calculate_PendingLeaveDoesNotReduceLop()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            Array.Empty<Attendance>(),
            new[] { Leave(2026, 4, 1, 2026, 4, 2, LeaveStatuses.Pending) },
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 2));

        Assert.Equal(2m, result.LopDays);
    }

    [Fact]
    public void Calculate_ZeroLopStatusesDoNotReduceAttendance()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            new[]
            {
                Attendance(2026, 4, 1, "Present"),
                Attendance(2026, 4, 2, "Late"),
                Attendance(2026, 4, 3, "MissingPunch"),
                Attendance(2026, 4, 4, "Leave"),
                Attendance(2026, 4, 5, "Holiday")
            },
            Array.Empty<Leave>(),
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 5));

        Assert.Equal(0m, result.LopDays);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Calculate_SkipsBeforeJoiningAndAfterCutoff()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            new DateTime(2026, 4, 10),
            Array.Empty<Attendance>(),
            Array.Empty<Leave>(),
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 12));

        Assert.Equal(3m, result.LopDays);
        Assert.Equal(3, result.Warnings.Count);
    }

    [Fact]
    public void Calculate_DoesNotCountFutureDaysInCurrentMonth()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            Array.Empty<Attendance>(),
            Array.Empty<Leave>(),
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 10));

        Assert.Equal(10m, result.LopDays);
    }

    [Fact]
    public void Calculate_UnknownStatusWarnsButCountsAsPresent()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            new[] { Attendance(2026, 4, 1, "Remote") },
            Array.Empty<Leave>(),
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 1));

        Assert.Equal(0m, result.LopDays);
        Assert.Contains(result.Warnings, w => w.Contains("Unknown attendance status", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Calculate_ApprovedLeaveOverridesAbsentAttendance()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            new[] { Attendance(2026, 4, 1, "Absent") },
            new[] { Leave(2026, 4, 1, 2026, 4, 1, LeaveStatuses.Approved) },
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 1));

        Assert.Equal(0m, result.LopDays);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Calculate_UsesLatestAttendanceRecordForDuplicateDate()
    {
        var result = LopCalculator.Calculate(
            2026,
            4,
            JoinedLongAgo,
            new[]
            {
                Attendance(2026, 4, 1, "Absent", id: 1, updatedAt: new DateTime(2026, 4, 1, 9, 0, 0)),
                Attendance(2026, 4, 1, "Present", id: 2, updatedAt: new DateTime(2026, 4, 1, 10, 0, 0))
            },
            Array.Empty<Leave>(),
            Array.Empty<DateTime>(),
            Array.Empty<DayOfWeek>(),
            new DateTime(2026, 4, 1));

        Assert.Equal(0m, result.LopDays);
    }

    private static Attendance Attendance(
        int year,
        int month,
        int day,
        string status,
        int id = 0,
        DateTime? updatedAt = null) =>
        new()
        {
            Id = id,
            AttendanceDate = new DateTime(year, month, day),
            Status = status,
            UpdatedAt = updatedAt ?? default
        };

    private static Leave Leave(
        int startYear,
        int startMonth,
        int startDay,
        int endYear,
        int endMonth,
        int endDay,
        string status) =>
        new()
        {
            StartDate = new DateTime(startYear, startMonth, startDay),
            EndDate = new DateTime(endYear, endMonth, endDay),
            Status = status
        };
}
