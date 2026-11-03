using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class AttendanceConfigRepository : IAttendanceConfigRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public AttendanceConfigRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string SelectSql = @"
            SELECT id                            AS ""Id"",
                   effective_from                AS ""EffectiveFrom"",
                   standard_hours                AS ""StandardHours"",
                   max_hours_per_day             AS ""MaxHoursPerDay"",
                   min_gap_same_day_minutes      AS ""MinGapSameDayMinutes"",
                   min_rest_normal_minutes       AS ""MinRestNormalMinutes"",
                   rest_after_extended_minutes   AS ""RestAfterExtendedMinutes"",
                   max_extended_per_week         AS ""MaxExtendedPerWeek"",
                   punch_early_minutes           AS ""PunchEarlyMinutes"",
                   punch_late_minutes            AS ""PunchLateMinutes"",
                   late_grace_minutes            AS ""LateGraceMinutes"",
                   unpaid_break_minutes          AS ""UnpaidBreakMinutes"",
                   overtime_multiplier           AS ""OvertimeMultiplier"",
                   updated_at                    AS ""UpdatedAt"",
                   updated_by                    AS ""UpdatedBy""
              FROM attendance_config";

        public async Task<AttendanceConfig> GetAsync()
        {
            return await GetEffectiveAsync(DateTime.Today);
        }

        public async Task<AttendanceConfig> GetEffectiveAsync(DateTime date)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            var config = await connection.QuerySingleOrDefaultAsync<AttendanceConfig>(
                $@"{SelectSql}
                   WHERE effective_from <= @Date::date
                   ORDER BY effective_from DESC, id DESC
                   LIMIT 1",
                new { Date = date.Date });

            if (config != null)
                return config;

            return await connection.QuerySingleAsync<AttendanceConfig>(
                $@"{SelectSql}
                   ORDER BY effective_from, id
                   LIMIT 1");
        }

        public async Task<AttendanceConfig> CreateVersionAsync(
            AttendanceConfigUpdateRequest request,
            int updatedBy)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            var effectiveFrom = (request.EffectiveFrom ?? DateTime.Today).Date;

            const string sql = @"
                WITH base AS (
                    SELECT *
                      FROM attendance_config
                     ORDER BY effective_from DESC, id DESC
                     LIMIT 1
                )
                INSERT INTO attendance_config (
                    effective_from,
                    standard_hours,
                    max_hours_per_day,
                    min_gap_same_day_minutes,
                    min_rest_normal_minutes,
                    rest_after_extended_minutes,
                    max_extended_per_week,
                    punch_early_minutes,
                    punch_late_minutes,
                    late_grace_minutes,
                    unpaid_break_minutes,
                    overtime_multiplier,
                    updated_by
                )
                SELECT @EffectiveFrom::date,
                       COALESCE(@StandardHours::numeric, b.standard_hours),
                       COALESCE(@MaxHoursPerDay::numeric, b.max_hours_per_day),
                       COALESCE(@MinGapSameDayMinutes::int, b.min_gap_same_day_minutes),
                       COALESCE(@MinRestNormalMinutes::int, b.min_rest_normal_minutes),
                       COALESCE(@RestAfterExtendedMinutes::int, b.rest_after_extended_minutes),
                       COALESCE(@MaxExtendedPerWeek::int, b.max_extended_per_week),
                       COALESCE(@PunchEarlyMinutes::int, b.punch_early_minutes),
                       COALESCE(@PunchLateMinutes::int, b.punch_late_minutes),
                       COALESCE(@LateGraceMinutes::int, b.late_grace_minutes),
                       COALESCE(@UnpaidBreakMinutes::int, b.unpaid_break_minutes),
                       COALESCE(@OvertimeMultiplier::numeric, b.overtime_multiplier),
                       @UpdatedBy
                  FROM base b
                ON CONFLICT (effective_from) DO UPDATE SET
                    standard_hours = EXCLUDED.standard_hours,
                    max_hours_per_day = EXCLUDED.max_hours_per_day,
                    min_gap_same_day_minutes = EXCLUDED.min_gap_same_day_minutes,
                    min_rest_normal_minutes = EXCLUDED.min_rest_normal_minutes,
                    rest_after_extended_minutes = EXCLUDED.rest_after_extended_minutes,
                    max_extended_per_week = EXCLUDED.max_extended_per_week,
                    punch_early_minutes = EXCLUDED.punch_early_minutes,
                    punch_late_minutes = EXCLUDED.punch_late_minutes,
                    late_grace_minutes = EXCLUDED.late_grace_minutes,
                    unpaid_break_minutes = EXCLUDED.unpaid_break_minutes,
                    overtime_multiplier = EXCLUDED.overtime_multiplier,
                    updated_at = NOW(),
                    updated_by = EXCLUDED.updated_by
                RETURNING id                            AS ""Id"",
                          effective_from                AS ""EffectiveFrom"",
                          standard_hours                AS ""StandardHours"",
                          max_hours_per_day             AS ""MaxHoursPerDay"",
                          min_gap_same_day_minutes      AS ""MinGapSameDayMinutes"",
                          min_rest_normal_minutes       AS ""MinRestNormalMinutes"",
                          rest_after_extended_minutes   AS ""RestAfterExtendedMinutes"",
                          max_extended_per_week         AS ""MaxExtendedPerWeek"",
                          punch_early_minutes           AS ""PunchEarlyMinutes"",
                          punch_late_minutes            AS ""PunchLateMinutes"",
                          late_grace_minutes            AS ""LateGraceMinutes"",
                          unpaid_break_minutes          AS ""UnpaidBreakMinutes"",
                          overtime_multiplier           AS ""OvertimeMultiplier"",
                          updated_at                    AS ""UpdatedAt"",
                          updated_by                    AS ""UpdatedBy""";

            return await connection.QuerySingleAsync<AttendanceConfig>(sql, new
            {
                EffectiveFrom = effectiveFrom,
                request.StandardHours,
                request.MaxHoursPerDay,
                request.MinGapSameDayMinutes,
                request.MinRestNormalMinutes,
                request.RestAfterExtendedMinutes,
                request.MaxExtendedPerWeek,
                request.PunchEarlyMinutes,
                request.PunchLateMinutes,
                request.LateGraceMinutes,
                request.UnpaidBreakMinutes,
                request.OvertimeMultiplier,
                UpdatedBy = updatedBy
            });
        }
    }
}
