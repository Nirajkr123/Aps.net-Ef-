using System.Text.Json;
using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Services
{
    public sealed record EffectiveAttendanceRuleSet(
        int EarlyCheckinMinutes,
        int GraceMinutes,
        int LateLimitMinutes,
        int CheckoutBufferMinutes,
        string Source);

    public static class AttendanceRuleResolver
    {
        public static EffectiveAttendanceRuleSet Resolve(
            AttendanceConfig config,
            AttendanceShiftSnapshot? shift,
            DateTime attendanceDate)
        {
            var active = new ShiftRules(
                shift?.EarlyCheckinMinutes,
                shift?.GraceMinutes,
                shift?.LateLimitMinutes,
                shift?.CheckoutBufferMinutes);

            var rules = active;
            var pending = false;

            if (shift is not null
                && !string.IsNullOrWhiteSpace(shift.PendingRules)
                && shift.PendingRulesFrom.HasValue
                && attendanceDate.Date >= shift.PendingRulesFrom.Value.Date)
            {
                var pendingRules = ParsePendingRules(shift.PendingRules);
                if (pendingRules is not null)
                {
                    rules = new ShiftRules(
                        pendingRules.EarlyCheckinMinutes ?? active.EarlyCheckinMinutes,
                        pendingRules.GraceMinutes ?? active.GraceMinutes,
                        pendingRules.LateLimitMinutes ?? active.LateLimitMinutes,
                        pendingRules.CheckoutBufferMinutes ?? active.CheckoutBufferMinutes);
                    pending = true;
                }
            }

            var source = (rules.EarlyCheckinMinutes ?? rules.GraceMinutes ?? rules.LateLimitMinutes
                ?? rules.CheckoutBufferMinutes) is not null
                    ? (pending ? "SHIFT_PENDING" : "SHIFT")
                    : "GLOBAL";

            return new EffectiveAttendanceRuleSet(
                rules.EarlyCheckinMinutes ?? config.PunchEarlyMinutes,
                rules.GraceMinutes ?? config.LateGraceMinutes,
                rules.LateLimitMinutes ?? config.PunchLateMinutes,
                rules.CheckoutBufferMinutes ?? config.CheckoutBufferMinutes,
                source);
        }

        private static ShiftRules? ParsePendingRules(string json)
        {
            try
            {
                using var document = JsonDocument.Parse(json);
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object)
                    return null;

                return new ShiftRules(
                    ReadInt(root, "early_checkin_minutes", "earlyCheckinMinutes"),
                    ReadInt(root, "grace_minutes", "graceMinutes"),
                    ReadInt(root, "late_limit_minutes", "lateLimitMinutes"),
                    ReadInt(root, "checkout_buffer_minutes", "checkoutBufferMinutes"));
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static int? ReadInt(JsonElement root, params string[] names)
        {
            foreach (var name in names)
            {
                if (!root.TryGetProperty(name, out var value))
                    continue;

                if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number))
                    return number;

                if (value.ValueKind == JsonValueKind.String
                    && int.TryParse(value.GetString(), out number))
                    return number;
            }

            return null;
        }

        private sealed record ShiftRules(
            int? EarlyCheckinMinutes,
            int? GraceMinutes,
            int? LateLimitMinutes,
            int? CheckoutBufferMinutes);
    }
}
