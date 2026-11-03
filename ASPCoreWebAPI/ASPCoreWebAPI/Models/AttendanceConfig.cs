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
        public int PunchEarlyMinutes { get; set; } = 60;
        public int PunchLateMinutes { get; set; } = 120;
        public int LateGraceMinutes { get; set; } = 15;
        public int UnpaidBreakMinutes { get; set; }
        public decimal OvertimeMultiplier { get; set; } = 1.5m;
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
    }
}
