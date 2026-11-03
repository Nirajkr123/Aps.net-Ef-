using System.Globalization;

namespace ASPCoreWebAPI.Models
{
    public class Shift
    {
        public int ShiftId { get; set; }
        public string ShiftName { get; set; } = string.Empty;
        public TimeOnly StartTime { get; set; }
        public decimal DurationHours { get; set; } = 10m;
        public TimeOnly EndTime { get; set; }
        public bool CrossesMidnight { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class ShiftRequest
    {
        public string? ShiftName { get; set; }
        public string? StartTime { get; set; }
        public decimal? DurationHours { get; set; }
        public bool? IsActive { get; set; }
    }

    public class ShiftStatusRequest
    {
        public bool IsActive { get; set; }
    }

    public static class ShiftTime
    {
        public static bool TryParse(string? value, out TimeOnly result)
        {
            result = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            return TimeOnly.TryParse(value.Trim(), CultureInfo.InvariantCulture, out result);
        }

        public static (TimeOnly End, bool CrossesMidnight) CalculateEnd(
            TimeOnly start,
            decimal durationHours)
        {
            var totalHours = start.Hour + start.Minute / 60.0 + start.Second / 3600.0
                             + (double)durationHours;
            var crossesMidnight = totalHours >= 24;
            var end = TimeOnly.FromTimeSpan(TimeSpan.FromHours(totalHours % 24));
            return (end, crossesMidnight);
        }

        public static string ToDisplay(TimeOnly value) =>
            value.ToString("HH:mm", CultureInfo.InvariantCulture);
    }
}
