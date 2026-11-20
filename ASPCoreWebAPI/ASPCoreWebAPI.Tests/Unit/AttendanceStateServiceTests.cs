using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Services;

namespace ASPCoreWebAPI.Tests.Unit;

public class AttendanceStateServiceTests
{
    private static readonly TimeSpan IstOffset = TimeSpan.FromHours(5.5);

    [Fact]
    public async Task GetTodayState_At1130Pm_ReturnsOpenNightShiftWindow()
    {
        var service = CreateService(
            utcNow: new DateTime(2026, 11, 10, 18, 0, 0, DateTimeKind.Utc),
            shift: NightShift());

        var state = await service.GetTodayStateAsync(101);

        Assert.Equal(TimeSpan.FromHours(5.5), state.ServerNow.Offset);
        Assert.Equal(AttendanceWindowStates.Open, state.WindowState);
        Assert.True(state.CanCheckIn);
        Assert.True(state.IsWithinWindow);
        Assert.Equal(new DateOnly(2026, 11, 10), state.Shift!.ShiftDate);
        Assert.Equal(new DateTimeOffset(2026, 11, 10, 22, 30, 0, IstOffset), state.WindowOpensAt);
        Assert.Equal(new DateTimeOffset(2026, 11, 11, 1, 0, 0, IstOffset), state.CheckInDeadlineAt);
    }

    [Fact]
    public async Task GetTodayState_At1230Am_StillUsesPreviousDayNightShift()
    {
        var service = CreateService(
            utcNow: new DateTime(2026, 11, 10, 19, 0, 0, DateTimeKind.Utc),
            shift: NightShift());

        var state = await service.GetTodayStateAsync(101);

        Assert.Equal(AttendanceWindowStates.Open, state.WindowState);
        Assert.True(state.CanCheckIn);
        Assert.Equal(new DateOnly(2026, 11, 10), state.AttendanceDate);
        Assert.Equal(new DateOnly(2026, 11, 10), state.Shift!.ShiftDate);
        Assert.Equal(new DateTimeOffset(2026, 11, 10, 23, 0, 0, IstOffset), state.Shift.StartAt);
        Assert.Equal(new DateTimeOffset(2026, 11, 11, 7, 0, 0, IstOffset), state.Shift.EndAt);
    }

    [Fact]
    public async Task GetTodayState_AfterLateLimit_ClosesOnlyCheckIn()
    {
        var service = CreateService(
            utcNow: new DateTime(2026, 11, 10, 20, 30, 0, DateTimeKind.Utc),
            shift: NightShift());

        var state = await service.GetTodayStateAsync(101);

        Assert.Equal(AttendanceWindowStates.CheckInClosed, state.WindowState);
        Assert.False(state.CanCheckIn);
        Assert.True(state.IsWithinWindow);
        Assert.Contains(AttendanceStateFlags.CheckInClosed, state.Flags);
    }

    [Fact]
    public async Task GetTodayState_WithExistingCheckIn_ReportsElapsedAndBlocksDuplicate()
    {
        var service = CreateService(
            utcNow: new DateTime(2026, 11, 10, 18, 30, 0, DateTimeKind.Utc),
            shift: NightShift(),
            attendance: new Attendance
            {
                Id = 55,
                EmployeeId = 101,
                CheckInTime = new DateTime(2026, 11, 10, 18, 5, 0),
                Status = "Present",
                Source = "SELF"
            });

        var state = await service.GetTodayStateAsync(101);

        Assert.False(state.CanCheckIn);
        Assert.True(state.CanCheckOut);
        Assert.Equal(1500, state.ElapsedSeconds);
        Assert.Contains(AttendanceStateFlags.AlreadyCheckedIn, state.Flags);
    }

    [Fact]
    public async Task GetTodayState_WithoutShift_ReturnsNoShift()
    {
        var service = CreateService(
            utcNow: new DateTime(2026, 11, 10, 18, 0, 0, DateTimeKind.Utc),
            shift: null);

        var state = await service.GetTodayStateAsync(101);

        Assert.Equal(AttendanceWindowStates.NoShift, state.WindowState);
        Assert.Null(state.Shift);
        Assert.False(state.CanCheckIn);
        Assert.Contains(AttendanceStateFlags.NoShift, state.Flags);
    }

    [Fact]
    public async Task GetTodayState_UsesPendingRulesFromNextDay()
    {
        var shift = NightShift();
        shift.ShiftDate = new DateTime(2026, 11, 11);
        shift.ShiftStartDt = new DateTime(2026, 11, 11, 23, 0, 0);
        shift.ShiftEndDt = new DateTime(2026, 11, 12, 7, 0, 0);
        shift.GraceMinutes = 10;
        shift.PendingRules = """{"grace_minutes":20,"late_limit_minutes":150}""";
        shift.PendingRulesFrom = new DateTime(2026, 11, 11);

        var service = CreateService(
            utcNow: new DateTime(2026, 11, 11, 18, 0, 0, DateTimeKind.Utc),
            shift: shift);

        var state = await service.GetTodayStateAsync(101);

        Assert.Equal(20, state.Rules.GraceMinutes);
        Assert.Equal(150, state.Rules.LateLimitMinutes);
        Assert.Equal("SHIFT_PENDING", state.Rules.Source);
    }

    private static AttendanceStateService CreateService(
        DateTime utcNow,
        AttendanceShiftSnapshot? shift,
        Attendance? attendance = null)
    {
        return new AttendanceStateService(
            new FakeStateRepository(shift, attendance),
            new FakeConfigRepository(),
            new FakeClock(utcNow),
            new FakeTimeZoneResolver());
    }

    private static AttendanceShiftSnapshot NightShift()
    {
        return new AttendanceShiftSnapshot
        {
            AssignmentId = 10,
            ShiftId = 3,
            ShiftName = "Night",
            ShiftDate = new DateTime(2026, 11, 10),
            ShiftStartDt = new DateTime(2026, 11, 10, 23, 0, 0),
            ShiftEndDt = new DateTime(2026, 11, 11, 7, 0, 0),
            CrossesMidnight = true
        };
    }

    private sealed class FakeClock : IClock
    {
        public FakeClock(DateTime utcNow)
        {
            UtcNow = utcNow;
        }

        public DateTime UtcNow { get; }
    }

    private sealed class FakeConfigRepository : IAttendanceConfigRepository
    {
        private readonly AttendanceConfig _config = new()
        {
            PunchEarlyMinutes = 30,
            PunchLateMinutes = 120,
            LateGraceMinutes = 10,
            CheckoutBufferMinutes = 240,
            TimezoneId = "Asia/Kolkata",
            EnforcementMode = "WARN"
        };

        public Task<AttendanceConfig> GetAsync() => Task.FromResult(_config);

        public Task<AttendanceConfig> GetEffectiveAsync(DateTime date) => Task.FromResult(_config);

        public Task<AttendanceConfig> CreateVersionAsync(
            AttendanceConfigUpdateRequest request,
            int updatedBy) => throw new NotSupportedException();
    }

    private sealed class FakeStateRepository : IAttendanceStateRepository
    {
        private readonly AttendanceShiftSnapshot? _shift;
        private readonly Attendance? _attendance;

        public FakeStateRepository(
            AttendanceShiftSnapshot? shift,
            Attendance? attendance)
        {
            _shift = shift;
            _attendance = attendance;
        }

        public Task<AttendanceShiftSnapshot?> GetShiftForStateAsync(
            int employeeId,
            DateTime today,
            DateTime yesterday,
            DateTime nowLocal,
            int fallbackCheckoutBufferMinutes) => Task.FromResult(_shift);

        public Task<AttendanceShiftSnapshot?> GetShiftByAssignmentIdAsync(
            int assignmentId) => Task.FromResult(_shift);

        public Task<Attendance?> GetAttendanceForStateAsync(
            int employeeId,
            int? shiftAssignmentId,
            DateTime attendanceDate) => Task.FromResult(_attendance);

        public Task<Attendance?> GetOpenAttendanceForEmployeeAsync(
            int employeeId) => Task.FromResult(_attendance);

        public Task<int> CloseStaleOpenAttendancesAsync(
            int employeeId,
            DateTime currentAttendanceDate,
            DateTime nowLocal,
            DateTime nowUtc,
            int fallbackCheckoutBufferMinutes) => Task.FromResult(0);

        public Task MarkMissedCheckoutAsync(int attendanceId, DateTime nowUtc) => Task.CompletedTask;

        public Task LogWindowWarningAsync(
            int? userId,
            int? attendanceId,
            string action,
            string details,
            string reason) => Task.CompletedTask;
    }

    private sealed class FakeTimeZoneResolver : IAttendanceTimeZoneResolver
    {
        private static readonly TimeZoneInfo Ist = TimeZoneInfo.CreateCustomTimeZone(
            "IST",
            IstOffset,
            "India Standard Time",
            "India Standard Time");

        public TimeZoneInfo Resolve(string? timeZoneId) => Ist;
    }
}
