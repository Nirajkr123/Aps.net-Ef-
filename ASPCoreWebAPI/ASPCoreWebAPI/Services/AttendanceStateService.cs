using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;

namespace ASPCoreWebAPI.Services
{
    public interface IAttendanceStateService
    {
        Task<TodayStateDto> GetTodayStateAsync(int employeeId);
    }

    public sealed class AttendanceStateService : IAttendanceStateService
    {
        private readonly IAttendanceStateRepository _stateRepository;
        private readonly IAttendanceConfigRepository _configRepository;
        private readonly IClock _clock;
        private readonly IAttendanceTimeZoneResolver _timeZoneResolver;

        public AttendanceStateService(
            IAttendanceStateRepository stateRepository,
            IAttendanceConfigRepository configRepository,
            IClock clock,
            IAttendanceTimeZoneResolver timeZoneResolver)
        {
            _stateRepository = stateRepository;
            _configRepository = configRepository;
            _clock = clock;
            _timeZoneResolver = timeZoneResolver;
        }

        public async Task<TodayStateDto> GetTodayStateAsync(int employeeId)
        {
            var initialConfig = await _configRepository.GetAsync();
            var timeZone = _timeZoneResolver.Resolve(initialConfig.TimezoneId);

            var nowUtc = AsUtc(_clock.UtcNow);
            var nowOffset = TimeZoneInfo.ConvertTime(new DateTimeOffset(nowUtc), timeZone);
            var nowLocal = nowOffset.DateTime;

            var config = await _configRepository.GetEffectiveAsync(nowLocal.Date);
            var today = nowLocal.Date;
            var yesterday = today.AddDays(-1);

            var shift = await _stateRepository.GetShiftForStateAsync(
                employeeId,
                today,
                yesterday,
                nowLocal,
                config.CheckoutBufferMinutes);

            var attendanceDate = shift?.ShiftDate.Date ?? today;
            var attendance = await _stateRepository.GetAttendanceForStateAsync(
                employeeId,
                shift?.AssignmentId,
                attendanceDate);

            var overrides = AttendanceRuleResolver.Resolve(config, shift, attendanceDate);
            var flags = new List<string>();

            DateTimeOffset? windowOpensAt = null;
            DateTimeOffset? windowClosesAt = null;
            DateTimeOffset? checkInDeadlineAt = null;
            var windowState = AttendanceWindowStates.NoShift;
            var isWithinWindow = false;
            var canCheckIn = false;
            var canCheckOut = false;

            if (shift is not null)
            {
                var windowOpensLocal = shift.ShiftStartDt.AddMinutes(-overrides.EarlyCheckinMinutes);
                var checkInDeadlineLocal = shift.ShiftStartDt.AddMinutes(overrides.LateLimitMinutes);
                var windowClosesLocal = shift.ShiftEndDt.AddMinutes(overrides.CheckoutBufferMinutes);

                windowOpensAt = ToLocalOffset(windowOpensLocal, timeZone);
                checkInDeadlineAt = ToLocalOffset(checkInDeadlineLocal, timeZone);
                windowClosesAt = ToLocalOffset(windowClosesLocal, timeZone);

                isWithinWindow = nowLocal >= windowOpensLocal && nowLocal <= windowClosesLocal;

                if (nowLocal < windowOpensLocal)
                {
                    windowState = AttendanceWindowStates.BeforeWindow;
                    AddFlag(flags, AttendanceStateFlags.BeforeWindow);
                }
                else if (nowLocal > windowClosesLocal)
                {
                    windowState = AttendanceWindowStates.Closed;
                    AddFlag(flags, AttendanceStateFlags.WindowClosed);
                }
                else if (nowLocal > checkInDeadlineLocal)
                {
                    windowState = AttendanceWindowStates.CheckInClosed;
                    AddFlag(flags, AttendanceStateFlags.CheckInClosed);
                }
                else
                {
                    windowState = AttendanceWindowStates.Open;
                }

                if (!isWithinWindow)
                    AddFlag(flags, AttendanceStateFlags.OutsideWindow);

                var hasCheckedIn = attendance?.CheckInTime is not null;
                if (hasCheckedIn)
                    AddFlag(flags, AttendanceStateFlags.AlreadyCheckedIn);

                canCheckIn = !hasCheckedIn
                    && nowLocal >= windowOpensLocal
                    && nowLocal <= checkInDeadlineLocal;

                var hasOpenCheckOut = hasCheckedIn && attendance?.CheckOutTime is null;
                canCheckOut = hasOpenCheckOut && nowLocal <= windowClosesLocal;
            }
            else
            {
                AddFlag(flags, AttendanceStateFlags.NoShift);

                var hasOpenCheckOut = attendance?.CheckInTime is not null
                    && attendance.CheckOutTime is null;
                canCheckOut = hasOpenCheckOut;
            }

            if (attendance?.CheckOutTime is not null)
                AddFlag(flags, AttendanceStateFlags.AlreadyCheckedOut);

            var elapsedSeconds = CalculateElapsedSeconds(attendance, nowUtc);

            return new TodayStateDto
            {
                ServerNow = nowOffset,
                TimezoneId = config.TimezoneId,
                EnforcementMode = config.EnforcementMode,
                AttendanceDate = DateOnly.FromDateTime(attendanceDate),
                Shift = shift is null
                    ? null
                    : new TodayShiftDto
                    {
                        AssignmentId = shift.AssignmentId,
                        ShiftId = shift.ShiftId,
                        ShiftName = shift.ShiftName,
                        ShiftDate = DateOnly.FromDateTime(shift.ShiftDate.Date),
                        StartAt = ToLocalOffset(shift.ShiftStartDt, timeZone),
                        EndAt = ToLocalOffset(shift.ShiftEndDt, timeZone),
                        CrossesMidnight = shift.CrossesMidnight
                    },
                WindowOpensAt = windowOpensAt,
                WindowClosesAt = windowClosesAt,
                CheckInDeadlineAt = checkInDeadlineAt,
                WindowState = windowState,
                Rules = new TodayRulesDto
                {
                    EarlyCheckinMinutes = overrides.EarlyCheckinMinutes,
                    GraceMinutes = overrides.GraceMinutes,
                    LateLimitMinutes = overrides.LateLimitMinutes,
                    CheckoutBufferMinutes = overrides.CheckoutBufferMinutes,
                    Source = overrides.Source
                },
                Attendance = attendance is null
                    ? null
                    : new TodayAttendanceDto
                    {
                        Id = attendance.Id,
                        CheckInTime = ToUtcOffset(attendance.CheckInTime, timeZone),
                        CheckOutTime = ToUtcOffset(attendance.CheckOutTime, timeZone),
                        Status = attendance.Status,
                        IsLate = attendance.IsLate,
                        Source = attendance.Source,
                        MissingPunchDetectedAt = ToUtcOffset(attendance.MissingPunchDetectedAt, timeZone),
                        Location = attendance.Location,
                        CheckInLatitude = attendance.CheckInLatitude,
                        CheckInLongitude = attendance.CheckInLongitude,
                        CheckOutLatitude = attendance.CheckOutLatitude,
                        CheckOutLongitude = attendance.CheckOutLongitude,
                        CheckInLocationName = attendance.CheckInLocationName,
                        CheckOutLocationName = attendance.CheckOutLocationName
                    },
                ElapsedSeconds = elapsedSeconds,
                IsWithinWindow = isWithinWindow,
                CanCheckIn = canCheckIn,
                CanCheckOut = canCheckOut,
                Flags = flags
            };
        }

        private static long CalculateElapsedSeconds(Attendance? attendance, DateTime nowUtc)
        {
            if (attendance?.CheckInTime is null)
                return 0;

            var end = attendance.CheckOutTime ?? nowUtc;
            var seconds = (AsUtc(end) - AsUtc(attendance.CheckInTime.Value)).TotalSeconds;
            return seconds <= 0 ? 0 : (long)Math.Floor(seconds);
        }

        private static DateTime AsUtc(DateTime value)
        {
            return value.Kind == DateTimeKind.Utc
                ? value
                : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }

        private static DateTimeOffset ToLocalOffset(DateTime local, TimeZoneInfo timeZone)
        {
            var value = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
            return new DateTimeOffset(value, timeZone.GetUtcOffset(value));
        }

        private static DateTimeOffset? ToUtcOffset(DateTime? utc, TimeZoneInfo timeZone)
        {
            return utc is null
                ? null
                : TimeZoneInfo.ConvertTime(new DateTimeOffset(AsUtc(utc.Value)), timeZone);
        }

        private static void AddFlag(List<string> flags, string flag)
        {
            if (!flags.Contains(flag))
                flags.Add(flag);
        }
    }
}
