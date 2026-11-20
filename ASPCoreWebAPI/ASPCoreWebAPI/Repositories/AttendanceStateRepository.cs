using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class AttendanceStateRepository : IAttendanceStateRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public AttendanceStateRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string ShiftSelect = @"
            SELECT sa.id                           AS ""AssignmentId"",
                   sa.shift_id                     AS ""ShiftId"",
                   s.shift_name                    AS ""ShiftName"",
                   sa.shift_date::timestamp        AS ""ShiftDate"",
                   sa.shift_start_dt               AS ""ShiftStartDt"",
                   sa.shift_end_dt                 AS ""ShiftEndDt"",
                   s.crosses_midnight              AS ""CrossesMidnight"",
                   s.early_checkin_minutes         AS ""EarlyCheckinMinutes"",
                   s.grace_minutes                 AS ""GraceMinutes"",
                   s.late_limit_minutes            AS ""LateLimitMinutes"",
                   s.checkout_buffer_minutes       AS ""CheckoutBufferMinutes"",
                   s.pending_rules::text           AS ""PendingRules"",
                   s.pending_rules_from::timestamp AS ""PendingRulesFrom""
              FROM ""shift_assignment"" sa
              JOIN ""shift"" s ON s.shift_id = sa.shift_id";

        private const string AttendanceSelect = @"
            SELECT a.id                         AS ""Id"",
                   a.employee_id                AS ""EmployeeId"",
                   a.attendance_date::timestamp AS ""AttendanceDate"",
                   a.shift_assignment_id        AS ""ShiftAssignmentId"",
                   a.check_in_time              AS ""CheckInTime"",
                   a.check_out_time             AS ""CheckOutTime"",
                   a.working_hours              AS ""WorkingHours"",
                   a.status::text               AS ""Status"",
                   a.is_late                    AS ""IsLate"",
                   a.missing_punch_detected_at  AS ""MissingPunchDetectedAt"",
                   a.source                     AS ""Source"",
                   a.created_at                 AS ""CreatedAt"",
                   a.updated_at                 AS ""UpdatedAt"",
                   a.location                   AS ""Location"",
                   a.check_in_latitude          AS ""CheckInLatitude"",
                   a.check_in_longitude         AS ""CheckInLongitude"",
                   a.check_out_latitude         AS ""CheckOutLatitude"",
                   a.check_out_longitude        AS ""CheckOutLongitude"",
                   COALESCE(wl_in.""Name"", a.check_in_location_name)   AS ""CheckInLocationName"",
                   COALESCE(wl_out.""Name"", a.check_out_location_name) AS ""CheckOutLocationName""
              FROM ""attendance"" a
              LEFT JOIN ""WorkLocations"" wl_in
                     ON wl_in.""Id"" = a.check_in_location_id
              LEFT JOIN ""WorkLocations"" wl_out
                     ON wl_out.""Id"" = a.check_out_location_id";

        public async Task<AttendanceShiftSnapshot?> GetShiftForStateAsync(
            int employeeId,
            DateTime today,
            DateTime yesterday,
            DateTime nowLocal,
            int fallbackCheckoutBufferMinutes)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            return await connection.QuerySingleOrDefaultAsync<AttendanceShiftSnapshot>(
                $@"{ShiftSelect}
                   WHERE sa.emp_id = @EmployeeId
                     AND sa.status = 'Assigned'
                     AND (
                         sa.shift_date = @Today::date
                         OR (
                             sa.shift_date = @Yesterday::date
                             AND sa.shift_end_dt
                                 + make_interval(mins => COALESCE(
                                     s.checkout_buffer_minutes,
                                     @FallbackCheckoutBuffer::int)) > @NowLocal::timestamp
                         )
                     )
                   ORDER BY CASE
                                WHEN sa.shift_date = @Yesterday::date
                                     AND sa.shift_end_dt
                                         + make_interval(mins => COALESCE(
                                             s.checkout_buffer_minutes,
                                             @FallbackCheckoutBuffer::int)) > @NowLocal::timestamp
                                    THEN 0
                                ELSE 1
                            END,
                            sa.shift_start_dt,
                            sa.id
                   LIMIT 1",
                new
                {
                    EmployeeId = employeeId,
                    Today = today.Date,
                    Yesterday = yesterday.Date,
                    NowLocal = nowLocal,
                    FallbackCheckoutBuffer = fallbackCheckoutBufferMinutes
                });
        }

        public async Task<AttendanceShiftSnapshot?> GetShiftByAssignmentIdAsync(int assignmentId)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            return await connection.QuerySingleOrDefaultAsync<AttendanceShiftSnapshot>(
                $@"{ShiftSelect}
                   WHERE sa.id = @AssignmentId",
                new { AssignmentId = assignmentId });
        }

        public async Task<Attendance?> GetAttendanceForStateAsync(
            int employeeId,
            int? shiftAssignmentId,
            DateTime attendanceDate)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            return await connection.QuerySingleOrDefaultAsync<Attendance>(
                $@"{AttendanceSelect}
                   WHERE a.employee_id = @EmployeeId
                     AND (
                         (@ShiftAssignmentId::int IS NOT NULL
                          AND a.shift_assignment_id = @ShiftAssignmentId::int)
                         OR (a.shift_assignment_id IS NULL
                             AND a.attendance_date = @AttendanceDate::date)
                     )
                   ORDER BY CASE
                                WHEN @ShiftAssignmentId::int IS NOT NULL
                                     AND a.shift_assignment_id = @ShiftAssignmentId::int
                                    THEN 0
                                ELSE 1
                            END,
                            a.id DESC
                   LIMIT 1",
                new
                {
                    EmployeeId = employeeId,
                    ShiftAssignmentId = shiftAssignmentId,
                    AttendanceDate = attendanceDate.Date
                });
        }

        public async Task<Attendance?> GetOpenAttendanceForEmployeeAsync(int employeeId)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            return await connection.QuerySingleOrDefaultAsync<Attendance>(
                $@"{AttendanceSelect}
                   WHERE a.employee_id = @EmployeeId
                     AND a.check_out_time IS NULL
                     AND a.missing_punch_detected_at IS NULL
                   ORDER BY a.attendance_date DESC, a.id DESC
                   LIMIT 1",
                new { EmployeeId = employeeId });
        }

        public async Task<int> CloseStaleOpenAttendancesAsync(
            int employeeId,
            DateTime currentAttendanceDate,
            DateTime nowLocal,
            DateTime nowUtc,
            int fallbackCheckoutBufferMinutes)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            return await connection.ExecuteAsync(
                @"WITH stale AS (
                      SELECT a.id,
                             COALESCE(
                                 sa.shift_end_dt,
                                 a.check_in_time + INTERVAL '8 hours'
                             ) AS closed_at
                        FROM ""attendance"" a
                        LEFT JOIN ""shift_assignment"" sa ON sa.id = a.shift_assignment_id
                        LEFT JOIN ""shift"" s ON s.shift_id = sa.shift_id
                       WHERE a.employee_id = @EmployeeId
                         AND a.check_out_time IS NULL
                         AND a.missing_punch_detected_at IS NULL
                         AND (
                             (a.shift_assignment_id IS NULL
                              AND a.attendance_date < @CurrentAttendanceDate::date)
                             OR
                             (a.shift_assignment_id IS NOT NULL
                              AND sa.shift_end_dt
                                  + make_interval(mins => COALESCE(
                                      s.checkout_buffer_minutes,
                                      @FallbackCheckoutBuffer::int))
                                  < @NowLocal::timestamp)
                         )
                  )
                  UPDATE ""attendance"" a
                     SET missing_punch_detected_at = @NowUtc,
                         check_out_time = CASE
                             WHEN a.shift_assignment_id IS NOT NULL
                                 THEN stale.closed_at
                             ELSE a.check_out_time
                         END,
                         status = 'MissingPunch'::attendance_status,
                         updated_at = NOW()
                    FROM stale
                   WHERE a.id = stale.id",
                new
                {
                    EmployeeId = employeeId,
                    CurrentAttendanceDate = currentAttendanceDate.Date,
                    NowLocal = nowLocal,
                    NowUtc = nowUtc,
                    FallbackCheckoutBuffer = fallbackCheckoutBufferMinutes
                });
        }

        public async Task MarkMissedCheckoutAsync(int attendanceId, DateTime nowUtc)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            await connection.ExecuteAsync(
                @"UPDATE ""attendance""
                     SET missing_punch_detected_at = COALESCE(missing_punch_detected_at, @Now),
                         updated_at = NOW()
                   WHERE id = @AttendanceId",
                new { AttendanceId = attendanceId, Now = nowUtc });
        }

        public async Task LogWindowWarningAsync(
            int? userId,
            int? attendanceId,
            string action,
            string details,
            string reason)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();

            await connection.ExecuteAsync(
                @"INSERT INTO audit_logs
                      (user_id, action, entity, entity_id, details, reason, source, at)
                  VALUES
                      (@UserId, @Action, 'attendance', @AttendanceId,
                       @Details::jsonb, @Reason, 'SELF', NOW())",
                new
                {
                    UserId = userId,
                    AttendanceId = attendanceId,
                    Action = action,
                    Details = details,
                    Reason = reason
                });
        }
    }
}
