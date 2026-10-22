namespace ASPCoreWebAPI.Models
{
    /* =====================================================================
       Leave quota — saal ke per-employee din.
       ---------------------------------------------------------------------
       Frontend ke `LEAVE_QUOTAS` (leaveService.js) ka server-side mirror.
       Dono ki values MATCH karni chahiye, warna Apply dialog "Casual (12
       left)" dikhaye aur server reject kar de.

       Totals: Casual 12, Sick 8, Earned 6, Personal 4.
       ===================================================================== */
    public static class LeaveQuota
    {
        public static readonly Dictionary<string, int> Defaults = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Casual"] = 12,
            ["Sick"] = 8,
            ["Earned"] = 6,
            ["Personal"] = 4,
        };

        public static readonly string[] Types = { "Casual", "Sick", "Earned", "Personal" };

        public static int TotalOf(string type) =>
            Defaults.TryGetValue(type, out var total) ? total : 0;

        public static bool IsValidType(string? type) =>
            !string.IsNullOrWhiteSpace(type) && Defaults.ContainsKey(type);

        /* Reason ka minimum length — frontend ke `REASON_MIN_LENGTH` (10)
           ka server-side mirror. Client validation sirf UX hai; ye asli
           rule hai. */
        public const int ReasonMinLength = 10;
    }
}
