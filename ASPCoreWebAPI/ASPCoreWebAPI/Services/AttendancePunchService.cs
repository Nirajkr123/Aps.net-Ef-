using System.Text.Json;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;

namespace ASPCoreWebAPI.Services
{
    public sealed record AttendancePunchLocation(
        double Latitude,
        double Longitude,
        double Accuracy,
        int LocationId,
        double DistanceMeters,
        string? IpAddress);

    public sealed class AttendancePunchResult
    {
        public Attendance Attendance { get; init; } = null!;
        public string? Warning { get; init; }
    }

    public sealed class AttendancePunchException : Exception
    {
        public AttendancePunchException(string code, string message) : base(message)
        {
            Code = code;
        }

        public string Code { get; }
    }

    public interface IAttendancePunchService
    {
        Task<AttendancePunchResult> CheckInAsync(
            int employeeId,
            int userId,
            AttendancePunchLocation location);

        Task<AttendancePunchResult> CheckOutAsync(
            int employeeId,
            int userId,
            AttendancePunchLocation location);
    }

    public sealed class AttendancePunchService : IAttendancePunchService
    {
        private readonly IAttendanceRepository _attendanceRepository;
        private readonly IAttendanceStateRepository _stateRepository;
        private readonly IAttendanceStateService _stateService;
        private readonly IAttendanceConfigRepository _configRepository;
        private readonly IClock _clock;
        private readonly IAttendanceTimeZoneResolver _timeZoneResolver;
        private readonly ILogger<AttendancePunchService> _logger;

        public AttendancePunchService(
            IAttendanceRepository attendanceRepository,
            IAttendanceStateRepository stateRepository,
            IAttendanceStateService stateService,
            IAttendanceConfigRepository configRepository,
            IClock clock,
            IAttendanceTimeZoneResolver timeZoneResolver,
            ILogger<AttendancePunchService> logger)
        {
            _attendanceRepository = attendanceRepository;
            _stateRepository = stateRepository;
            _stateService = stateService;
            _configRepository = configRepository;
            _clock = clock;
            _timeZoneResolver = timeZoneResolver;
            _logger = logger;
        }

        public async Task<AttendancePunchResult> CheckInAsync(
            int employeeId,
            int userId,
            AttendancePunchLocation location)
        {
            var state = await _stateService.GetTodayStateAsync(employeeId);
            var mode = NormalizeMode(state.EnforcementMode);

            if (state.Attendance?.CheckInTime is not null)
                throw new AttendancePunchException(
                    "already_checked_in",
                    "You have already checked in for this shift.");

            var nowUtc = AsUtc(_clock.UtcNow);

            // Purane missing-checkout records naye check-in ko block nahi karenge.
            // Sirf current attendance date ka open record block karta hai.
            await _stateRepository.CloseStaleOpenAttendancesAsync(
                employeeId,
                state.AttendanceDate.ToDateTime(TimeOnly.MinValue),
                state.ServerNow.DateTime,
                nowUtc,
                state.Rules.CheckoutBufferMinutes);

            var open = await _stateRepository.GetOpenAttendanceForEmployeeAsync(employeeId);
            if (open is not null)
                throw new AttendancePunchException(
                    "already_checked_in",
                    "An open attendance record already exists. Please check out first.");

            var warning = ValidateCheckIn(state, mode);

            var isLate = state.Shift is not null
                ? state.ServerNow > state.Shift.StartAt.AddMinutes(state.Rules.GraceMinutes)
                : state.ServerNow.TimeOfDay > new TimeSpan(9, 45, 0);

            var result = await _attendanceRepository.CheckInAsync(
                employeeId,
                location.Latitude,
                location.Longitude,
                location.Accuracy,
                location.LocationId,
                location.DistanceMeters,
                location.IpAddress,
                state.Shift?.AssignmentId,
                state.AttendanceDate.ToDateTime(TimeOnly.MinValue),
                nowUtc,
                isLate);

            result.Warning = warning;
            result.Flags = state.Flags;

            if (warning is not null)
            {
                await TryLogWarningAsync(
                    userId,
                    result.Id,
                    "ATTENDANCE_CHECKIN_WARNING",
                    new
                    {
                        action = "CHECK_IN",
                        mode,
                        windowState = state.WindowState,
                        flags = state.Flags,
                        warning
                    },
                    warning);
            }

            return new AttendancePunchResult
            {
                Attendance = result,
                Warning = warning
            };
        }

        public async Task<AttendancePunchResult> CheckOutAsync(
            int employeeId,
            int userId,
            AttendancePunchLocation location)
        {
            var open = await _stateRepository.GetOpenAttendanceForEmployeeAsync(employeeId);
            if (open is null)
                throw new AttendancePunchException(
                    "no_open_attendance",
                    "No open attendance record found. Please check in first.");

            if (open.CheckInTime is null)
                throw new AttendancePunchException(
                    "no_check_in",
                    "This attendance record has no check-in time. Please contact an administrator.");

            var initialConfig = await _configRepository.GetAsync();
            var timeZone = _timeZoneResolver.Resolve(initialConfig.TimezoneId);
            var nowUtc = AsUtc(_clock.UtcNow);
            var nowOffset = TimeZoneInfo.ConvertTime(new DateTimeOffset(nowUtc), timeZone);
            var nowLocal = nowOffset.DateTime;
            var attendanceDate = open.AttendanceDate.Date;
            var config = await _configRepository.GetEffectiveAsync(attendanceDate);
            var mode = NormalizeMode(config.EnforcementMode);

            var shift = open.ShiftAssignmentId.HasValue
                ? await _stateRepository.GetShiftByAssignmentIdAsync(open.ShiftAssignmentId.Value)
                : null;

            var rules = AttendanceRuleResolver.Resolve(config, shift, attendanceDate);

            if (shift is not null)
            {
                var checkoutClosesLocal = shift.ShiftEndDt.AddMinutes(rules.CheckoutBufferMinutes);

                if (nowLocal > checkoutClosesLocal && mode != "OFF")
                {
                    await _stateRepository.MarkMissedCheckoutAsync(open.Id, nowUtc);
                    var message = "The checkout window has closed. Please contact an administrator to regularize this attendance.";
                    await TryLogWarningAsync(
                        userId,
                        open.Id,
                        "ATTENDANCE_MISSED_CHECKOUT",
                        new
                        {
                            action = "CHECK_OUT",
                            mode,
                            shiftEnd = shift.ShiftEndDt,
                            checkoutBufferMinutes = rules.CheckoutBufferMinutes,
                            attemptedAt = nowLocal
                        },
                        message);

                    throw new AttendancePunchException("missed_checkout", message);
                }
            }

            var checkInLocal = TimeZoneInfo.ConvertTimeFromUtc(AsUtc(open.CheckInTime.Value), timeZone);
            var effectiveStart = shift is not null && checkInLocal < shift.ShiftStartDt
                ? shift.ShiftStartDt
                : checkInLocal;

            var workedHours = Math.Max(0, (decimal)(nowLocal - effectiveStart).TotalHours);
            workedHours = Math.Round(workedHours, 2);

            var status = workedHours >= config.FullDayMinHours
                ? "Present"
                : workedHours >= config.HalfDayMinHours
                    ? "Half-day"
                    : "Absent";

            var result = await _attendanceRepository.CheckOutAsync(
                employeeId,
                location.Latitude,
                location.Longitude,
                location.Accuracy,
                location.LocationId,
                location.DistanceMeters,
                nowUtc,
                workedHours,
                status);

            return new AttendancePunchResult
            {
                Attendance = result
            };
        }

        private static string? ValidateCheckIn(TodayStateDto state, string mode)
        {
            var violation = state.WindowState switch
            {
                AttendanceWindowStates.NoShift => "No shift is assigned for this attendance date.",
                AttendanceWindowStates.BeforeWindow => "Check-in is not open yet for your shift.",
                AttendanceWindowStates.CheckInClosed => "The check-in window has closed for your shift.",
                AttendanceWindowStates.Closed => "The shift window has closed.",
                _ when !state.CanCheckIn => "Check-in is outside the allowed shift window.",
                _ => null
            };

            if (violation is null)
                return null;

            if (mode == "ENFORCE")
                throw new AttendancePunchException(ViolationCode(state), violation);

            return mode == "WARN" ? violation : null;
        }

        private static string ViolationCode(TodayStateDto state)
        {
            return state.WindowState switch
            {
                AttendanceWindowStates.NoShift => "no_shift_assigned",
                AttendanceWindowStates.BeforeWindow => "checkin_not_open",
                AttendanceWindowStates.CheckInClosed => "checkin_closed",
                AttendanceWindowStates.Closed => "window_closed",
                _ => "outside_checkin_window"
            };
        }

        private static string NormalizeMode(string? mode)
        {
            return mode?.Trim().ToUpperInvariant() switch
            {
                "OFF" => "OFF",
                "ENFORCE" => "ENFORCE",
                _ => "WARN"
            };
        }

        private async Task TryLogWarningAsync(
            int? userId,
            int? attendanceId,
            string action,
            object details,
            string reason)
        {
            try
            {
                await _stateRepository.LogWindowWarningAsync(
                    userId,
                    attendanceId,
                    action,
                    JsonSerializer.Serialize(details),
                    reason);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to write attendance warning audit for attendance {AttendanceId}",
                    attendanceId);
            }
        }

        private static DateTime AsUtc(DateTime value)
        {
            return value.Kind == DateTimeKind.Utc
                ? value
                : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }
    }
}
