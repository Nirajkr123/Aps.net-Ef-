namespace ASPCoreWebAPI.Models
{
    public class AttendanceConfig
    {
        public short Id { get; set; }
        public DateTime EffectiveFrom { get; set; }
        public decimal StandardHours { get; set; } = 10m;
        public decimal MaxHoursPerDay { get; set; } = 20m;
        public int MinGapSameDayMinutes { get; set; } = 240;
        public int MinRestNormalMinutes { get; set; } = 480;
        public int RestAfterExtendedMinutes { get; set; } = 480;
        public int MaxExtendedPerWeek { get; set; } = 3;
        public int PunchEarlyMinutes { get; set; } = 30;
        public int PunchLateMinutes { get; set; } = 120;
        public int LateGraceMinutes { get; set; } = 10;
        public int UnpaidBreakMinutes { get; set; }
        public decimal OvertimeMultiplier { get; set; } = 1.5m;
        public int CheckoutBufferMinutes { get; set; } = 240;
        public decimal HalfDayMinHours { get; set; } = 4m;
        public decimal FullDayMinHours { get; set; } = 8m;
        public string TimezoneId { get; set; } = "Asia/Kolkata";
        public string EnforcementMode { get; set; } = "WARN";
        public bool MissedCheckoutCountsAsPresent { get; set; } = true;
        public bool SandwichRuleEnabled { get; set; }
        public bool HalfDayLopEnabled { get; set; } = true;
        public DateTime UpdatedAt { get; set; }
        public int? UpdatedBy { get; set; }
    }

    public class AttendanceConfigUpdateRequest
    {
        public DateTime? EffectiveFrom { get; set; }
        public decimal? StandardHours { get; set; }
        public decimal? MaxHoursPerDay { get; set; }
        public int? MinGapSameDayMinutes { get; set; }
        public int? MinRestNormalMinutes { get; set; }
        public int? RestAfterExtendedMinutes { get; set; }
        public int? MaxExtendedPerWeek { get; set; }
        public int? PunchEarlyMinutes { get; set; }
        public int? PunchLateMinutes { get; set; }
        public int? LateGraceMinutes { get; set; }
        public int? UnpaidBreakMinutes { get; set; }
        public decimal? OvertimeMultiplier { get; set; }
        public int? CheckoutBufferMinutes { get; set; }
        public decimal? HalfDayMinHours { get; set; }
        public decimal? FullDayMinHours { get; set; }
        public string? TimezoneId { get; set; }
        public string? EnforcementMode { get; set; }
        public bool? MissedCheckoutCountsAsPresent { get; set; }
        public bool? SandwichRuleEnabled { get; set; }
        public bool? HalfDayLopEnabled { get; set; }
    }
}
