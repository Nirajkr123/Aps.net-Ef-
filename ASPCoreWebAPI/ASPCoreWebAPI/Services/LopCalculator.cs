using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Services
{
    public sealed class LopCalculationResult
    {
        public int DaysInMonth { get; init; }
        public decimal LopDays { get; init; }
        public List<string> Warnings { get; init; } = new();
    }

    public static class LopCalculator
    {
        private static readonly HashSet<string> ZeroLopStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "Present",
            "Late",
            "MissingPunch",
            "Leave",
            "Holiday"
        };

        public static LopCalculationResult Calculate(
            int year,
            int month,
            DateTime? joiningDate,
            IEnumerable<Attendance>? attendance,
            IEnumerable<Leave>? leaves,
            IEnumerable<DateTime>? holidays,
            IEnumerable<DayOfWeek>? weekOffDays,
            DateTime? asOf = null)
        {
            var daysInMonth = DateTime.DaysInMonth(year, month);
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddDays(daysInMonth - 1);
            var cutoff = (asOf ?? DateTime.Today).Date;
            var joinedOn = joiningDate?.Date ?? DateTime.MinValue;

            var attendanceByDate = (attendance ?? Enumerable.Empty<Attendance>())
                .Where(a => a.AttendanceDate.Date >= monthStart && a.AttendanceDate.Date <= monthEnd)
                .GroupBy(a => a.AttendanceDate.Date)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(a => a.UpdatedAt).ThenByDescending(a => a.Id).First());

            var approvedLeaves = (leaves ?? Enumerable.Empty<Leave>())
                .Where(l => string.Equals(l.Status, LeaveStatuses.Approved, StringComparison.OrdinalIgnoreCase))
                .Select(l => (Start: l.StartDate.Date, End: l.EndDate.Date))
                .ToList();

            var holidayDates = (holidays ?? Enumerable.Empty<DateTime>())
                .Select(h => h.Date)
                .ToHashSet();

            var weekOffs = (weekOffDays ?? Enumerable.Empty<DayOfWeek>()).ToHashSet();

            var lopDays = 0m;
            var warnings = new List<string>();

            for (var date = monthStart; date <= monthEnd; date = date.AddDays(1))
            {
                if (date < joinedOn || date > cutoff)
                {
                    continue;
                }

                if (holidayDates.Contains(date) || weekOffs.Contains(date.DayOfWeek))
                {
                    continue;
                }

                if (approvedLeaves.Any(l => date >= l.Start && date <= l.End))
                {
                    continue;
                }

                if (!attendanceByDate.TryGetValue(date, out var record))
                {
                    lopDays += 1m;
                    warnings.Add($"No attendance record for {date:yyyy-MM-dd}; counted as LOP.");
                    continue;
                }

                var status = record.Status?.Trim() ?? string.Empty;

                if (status.Equals("Absent", StringComparison.OrdinalIgnoreCase))
                {
                    lopDays += 1m;
                }
                else if (status.Equals("Half-day", StringComparison.OrdinalIgnoreCase)
                         || status.Equals("Half Day", StringComparison.OrdinalIgnoreCase))
                {
                    lopDays += 0.5m;
                }
                else if (ZeroLopStatuses.Contains(status))
                {
                    continue;
                }
                else
                {
                    warnings.Add($"Unknown attendance status '{status}' on {date:yyyy-MM-dd}; treated as present.");
                }
            }

            return new LopCalculationResult
            {
                DaysInMonth = daysInMonth,
                LopDays = Math.Round(lopDays, 2, MidpointRounding.AwayFromZero),
                Warnings = warnings
            };
        }
    }
}
