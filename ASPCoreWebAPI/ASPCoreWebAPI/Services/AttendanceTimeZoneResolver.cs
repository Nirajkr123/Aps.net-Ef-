using Microsoft.Extensions.Configuration;

namespace ASPCoreWebAPI.Services
{
    public interface IAttendanceTimeZoneResolver
    {
        TimeZoneInfo Resolve(string? timeZoneId);
    }

    public sealed class AttendanceTimeZoneResolver : IAttendanceTimeZoneResolver
    {
        private const string DefaultTimeZoneId = "Asia/Kolkata";

        private static readonly Dictionary<string, string> WindowsFallbacks = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Asia/Kolkata"] = "India Standard Time",
            ["Asia/Calcutta"] = "India Standard Time",
            ["UTC"] = "UTC",
        };

        private readonly IConfiguration _configuration;

        public AttendanceTimeZoneResolver(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public TimeZoneInfo Resolve(string? timeZoneId)
        {
            var fallbackId = _configuration["Attendance:FallbackTimeZone"] ?? DefaultTimeZoneId;

            foreach (var candidate in Candidates(timeZoneId, fallbackId))
            {
                if (TimeZoneInfo.TryFindSystemTimeZoneById(candidate, out var zone))
                    return zone;
            }

            return TimeZoneInfo.Utc;
        }

        private static IEnumerable<string> Candidates(string? timeZoneId, string fallbackId)
        {
            foreach (var id in new[] { timeZoneId, fallbackId, DefaultTimeZoneId, "UTC" })
            {
                if (string.IsNullOrWhiteSpace(id))
                    continue;

                yield return id.Trim();

                if (WindowsFallbacks.TryGetValue(id.Trim(), out var windowsId))
                    yield return windowsId;
            }
        }
    }
}
