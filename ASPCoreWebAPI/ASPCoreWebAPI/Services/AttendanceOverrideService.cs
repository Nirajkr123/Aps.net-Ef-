using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;

namespace ASPCoreWebAPI.Services
{
    public sealed class AttendanceOverrideException : Exception
    {
        public AttendanceOverrideException(string code, string message) : base(message)
        {
            Code = code;
        }

        public string Code { get; }
    }

    public interface IAttendanceOverrideService
    {
        Task<Attendance?> OverrideAsync(int id, AttendanceUpdateDto dto, int userId);
    }

    public sealed class AttendanceOverrideService : IAttendanceOverrideService
    {
        private static readonly string[] AllowedStatuses =
        {
            "Present",
            "Absent",
            "Half-day",
            "Leave",
            "Holiday",
            "Late",
            "MissingPunch"
        };

        private readonly IAttendanceRepository _attendanceRepository;
        private readonly IAttendanceStateRepository _stateRepository;
        private readonly IAttendanceConfigRepository _configRepository;
        private readonly IAttendanceTimeZoneResolver _timeZoneResolver;

        public AttendanceOverrideService(
            IAttendanceRepository attendanceRepository,
            IAttendanceStateRepository stateRepository,
            IAttendanceConfigRepository configRepository,
            IAttendanceTimeZoneResolver timeZoneResolver)
        {
            _attendanceRepository = attendanceRepository;
            _stateRepository = stateRepository;
            _configRepository = configRepository;
            _timeZoneResolver = timeZoneResolver;
        }

        public async Task<Attendance?> OverrideAsync(int id, AttendanceUpdateDto dto, int userId)
        {
            var reason = dto.Reason?.Trim() ?? string.Empty;
            if (reason.Length < 5)
                throw new AttendanceOverrideException(
                    "reason_required",
                    "An override reason of at least 5 characters is required.");
            if (reason.Length > 500)
                throw new AttendanceOverrideException(
                    "reason_too_long",
                    "The override reason cannot exceed 500 characters.");

            var existing = await _attendanceRepository.GetByIdAsync(id);
            if (existing == null)
                return null;

            var requestedStatus = string.IsNullOrWhiteSpace(dto.Status)
                ? existing.Status
                : dto.Status.Trim();
            var status = AllowedStatuses.FirstOrDefault(
                item => string.Equals(item, requestedStatus, StringComparison.OrdinalIgnoreCase));

            if (status == null)
                throw new AttendanceOverrideException(
                    "invalid_status",
                    "The selected attendance status is not valid.");

            var config = await _configRepository.GetEffectiveAsync(existing.AttendanceDate.Date);
            var timeZone = _timeZoneResolver.Resolve(config.TimezoneId);

            var checkInLocal = ToLocalWallClock(dto.CheckInTime, timeZone);
            var checkOutLocal = ToLocalWallClock(dto.CheckOutTime, timeZone);
            var checkInUtc = ToUtc(checkInLocal, timeZone);
            var checkOutUtc = ToUtc(checkOutLocal, timeZone);

            if (checkInUtc.HasValue && checkOutUtc.HasValue && checkOutUtc.Value <= checkInUtc.Value)
                throw new AttendanceOverrideException(
                    "invalid_time_range",
                    "Check-out time must be after the check-in time.");

            decimal? workingHours = checkInUtc.HasValue && checkOutUtc.HasValue
                ? Math.Round((decimal)(checkOutUtc.Value - checkInUtc.Value).TotalHours, 2)
                : null;

            var shift = existing.ShiftAssignmentId.HasValue
                ? await _stateRepository.GetShiftByAssignmentIdAsync(existing.ShiftAssignmentId.Value)
                : null;
            var rules = AttendanceRuleResolver.Resolve(config, shift, existing.AttendanceDate);

            var isLate = string.Equals(status, "Late", StringComparison.OrdinalIgnoreCase);
            if (!isLate && checkInLocal.HasValue)
            {
                isLate = shift != null
                    ? checkInLocal.Value > shift.ShiftStartDt.AddMinutes(rules.GraceMinutes)
                    : checkInLocal.Value.TimeOfDay > new TimeSpan(9, 45, 0);
            }

            return await _attendanceRepository.OverrideAsync(
                id,
                userId,
                reason,
                checkInUtc,
                checkOutUtc,
                workingHours,
                status,
                isLate);
        }

        private static DateTime? ToLocalWallClock(DateTime? value, TimeZoneInfo timeZone)
        {
            if (!value.HasValue)
                return null;

            if (value.Value.Kind == DateTimeKind.Utc)
            {
                return DateTime.SpecifyKind(
                    TimeZoneInfo.ConvertTimeFromUtc(value.Value, timeZone),
                    DateTimeKind.Unspecified);
            }

            if (value.Value.Kind == DateTimeKind.Local)
            {
                return DateTime.SpecifyKind(
                    TimeZoneInfo.ConvertTime(value.Value, timeZone),
                    DateTimeKind.Unspecified);
            }

            return DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified);
        }

        private static DateTime? ToUtc(DateTime? local, TimeZoneInfo timeZone)
        {
            if (!local.HasValue)
                return null;

            try
            {
                return TimeZoneInfo.ConvertTimeToUtc(local.Value, timeZone);
            }
            catch (ArgumentException)
            {
                throw new AttendanceOverrideException(
                    "invalid_time",
                    "The selected time does not exist in the company timezone.");
            }
        }
    }
}
