using System.Text.Json;
using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class AttendanceRepository : IAttendanceRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public AttendanceRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string BaseSelect = @"
            SELECT a.""id"" AS ""Id"", a.""employee_id"" AS ""EmployeeId"", a.""attendance_date""::timestamp AS ""AttendanceDate"",
                   a.""check_in_time"" AT TIME ZONE 'UTC' AS ""CheckInTime"",
                   a.""check_out_time"" AT TIME ZONE 'UTC' AS ""CheckOutTime"",
                   a.""working_hours"" AS ""WorkingHours"", a.""status""::text AS ""Status"",
                   a.""is_late"" AS ""IsLate"", a.""location"" AS ""Location"",
                   a.""ip_address"" AS ""IpAddress"",
                   a.""check_in_latitude"" AS ""CheckInLatitude"",
                   a.""check_in_longitude"" AS ""CheckInLongitude"",
                   a.""check_in_accuracy"" AS ""CheckInAccuracy"",
                   a.""check_out_latitude"" AS ""CheckOutLatitude"",
                   a.""check_out_longitude"" AS ""CheckOutLongitude"",
                   a.""check_out_accuracy"" AS ""CheckOutAccuracy"",
                   a.""check_in_location_id"" AS ""CheckInLocationId"",
                   a.""check_out_location_id"" AS ""CheckOutLocationId"",
                   a.""check_in_distance_meters"" AS ""CheckInDistanceMeters"",
                   a.""check_out_distance_meters"" AS ""CheckOutDistanceMeters"",
                   a.""shift_assignment_id"" AS ""ShiftAssignmentId"",
                   a.""missing_punch_detected_at"" AT TIME ZONE 'UTC' AS ""MissingPunchDetectedAt"",
                   a.""source"" AS ""Source"",
                   a.""created_at"" AS ""CreatedAt"", a.""updated_at"" AS ""UpdatedAt"",
                   COALESCE(wl_in.""Name"", a.""check_in_location_name"") AS ""CheckInLocationName"",
                   COALESCE(wl_out.""Name"", a.""check_out_location_name"") AS ""CheckOutLocationName"",
                   COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''), 'Unknown') AS ""EmployeeName"",
                   COALESCE(e.""EmployeeCode"", '') AS ""EmployeeCode"",
                   COALESCE(u.""Email"", '') AS ""EmployeeEmail"",
                   COALESCE(dep.""Name"", '') AS ""Department"",
                   s.""shift_name"" AS ""ShiftName"",
                   sa.""shift_start_dt"" AS ""ShiftStartDt"",
                   sa.""shift_end_dt"" AS ""ShiftEndDt"",
                   s.""crosses_midnight"" AS ""ShiftCrossesMidnight""
             FROM ""attendance"" a
             LEFT JOIN ""Employees"" e ON a.""employee_id"" = e.""Id""
             LEFT JOIN ""Users"" u ON e.""UserId"" = u.""Id""
             LEFT JOIN ""Departments"" dep ON e.""DepartmentId"" = dep.""Id""
             LEFT JOIN ""WorkLocations"" wl_in ON a.""check_in_location_id"" = wl_in.""Id""
             LEFT JOIN ""WorkLocations"" wl_out ON a.""check_out_location_id"" = wl_out.""Id""
             LEFT JOIN ""shift_assignment"" sa ON a.""shift_assignment_id"" = sa.""id""
             LEFT JOIN ""shift"" s ON sa.""shift_id"" = s.""shift_id""";

        public async Task<Attendance> CheckInAsync(
            int employeeId,
            double latitude,
            double longitude,
            double accuracy,
            int locationId,
            double distanceMeters,
            string? ip,
            int? shiftAssignmentId,
            DateTime attendanceDate,
            DateTime checkInUtc,
            bool isLate)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var dbNow = AsDbTimestamp(checkInUtc);

            var existingId = await connection.QuerySingleOrDefaultAsync<int?>(
                @"SELECT ""id"" FROM ""attendance""
                   WHERE ""employee_id"" = @EmployeeId
                     AND (
                         (@ShiftAssignmentId::int IS NOT NULL
                          AND ""shift_assignment_id"" = @ShiftAssignmentId::int)
                         OR (""shift_assignment_id"" IS NULL
                             AND ""attendance_date"" = @AttendanceDate::date)
                     )
                   LIMIT 1",
                new
                {
                    EmployeeId = employeeId,
                    ShiftAssignmentId = shiftAssignmentId,
                    AttendanceDate = attendanceDate.Date
                });

            if (existingId.HasValue)
                throw new InvalidOperationException("Already checked in for this shift.");

            var openId = await connection.QuerySingleOrDefaultAsync<int?>(
                @"SELECT ""id"" FROM ""attendance""
                   WHERE ""employee_id"" = @EmployeeId
                     AND ""check_out_time"" IS NULL
                     AND ""missing_punch_detected_at"" IS NULL
                   LIMIT 1",
                new { EmployeeId = employeeId });

            if (openId.HasValue)
                throw new InvalidOperationException("An open attendance record already exists. Please check out first.");

            var id = await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""attendance""
                       (""employee_id"", ""attendance_date"", ""shift_assignment_id"", ""check_in_time"",
                        ""status"", ""is_late"", ""source"", ""ip_address"",
                        ""check_in_latitude"", ""check_in_longitude"", ""check_in_accuracy"",
                        ""check_in_location_id"", ""check_in_distance_meters"")
                   VALUES (@EmployeeId, @AttendanceDate::date, @ShiftAssignmentId::int, @Now,
                           @Status::attendance_status, @IsLate, 'SELF', @Ip,
                           @Latitude, @Longitude, @Accuracy, @LocationId, @DistanceMeters)
                   RETURNING ""id""",
                new
                {
                    EmployeeId = employeeId,
                    AttendanceDate = attendanceDate.Date,
                    ShiftAssignmentId = shiftAssignmentId,
                    Now = dbNow,
                    Status = isLate ? "Late" : "Present",
                    IsLate = isLate,
                    Ip = ip,
                    Latitude = latitude,
                    Longitude = longitude,
                    Accuracy = accuracy,
                    LocationId = locationId,
                    DistanceMeters = distanceMeters
                });

            return (await connection.QuerySingleOrDefaultAsync<Attendance>(
                $@"{BaseSelect} WHERE a.""id"" = @Id", new { Id = id }))!;
        }

        public async Task<Attendance> CheckOutAsync(
            int employeeId,
            double latitude,
            double longitude,
            double accuracy,
            int locationId,
            double distanceMeters,
            DateTime checkOutUtc,
            decimal workingHours,
            string status)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var dbNow = AsDbTimestamp(checkOutUtc);

            var existing = await connection.QuerySingleOrDefaultAsync<Attendance>(
                @"SELECT ""id"" AS ""Id"", ""employee_id"" AS ""EmployeeId"", ""attendance_date""::timestamp AS ""AttendanceDate"",
                         ""shift_assignment_id"" AS ""ShiftAssignmentId"",
                         ""check_in_time"" AS ""CheckInTime"", ""check_out_time"" AS ""CheckOutTime"",
                         ""working_hours"" AS ""WorkingHours"", ""status""::text AS ""Status"",
                         ""is_late"" AS ""IsLate"", ""location"" AS ""Location"", ""ip_address"" AS ""IpAddress"",
                         ""missing_punch_detected_at"" AS ""MissingPunchDetectedAt"",
                         ""source"" AS ""Source"",
                         ""created_at"" AS ""CreatedAt"", ""updated_at"" AS ""UpdatedAt""
                   FROM ""attendance""
                   WHERE ""employee_id"" = @EmployeeId AND ""check_out_time"" IS NULL
                   ORDER BY ""attendance_date"" DESC, ""id"" DESC
                   LIMIT 1",
                new { EmployeeId = employeeId });

            if (existing == null)
                throw new InvalidOperationException("No open attendance record found. Please check in first.");

            await connection.ExecuteAsync(
                @"UPDATE ""attendance""
                  SET ""check_out_time"" = @Now,
                      ""working_hours"" = @WorkingHours,
                      ""status"" = @Status::attendance_status,
                      ""check_out_latitude"" = @Latitude,
                      ""check_out_longitude"" = @Longitude,
                      ""check_out_accuracy"" = @Accuracy,
                      ""check_out_location_id"" = @LocationId,
                      ""check_out_distance_meters"" = @DistanceMeters
                  WHERE ""id"" = @Id",
                new
                {
                    Id = existing.Id,
                    Now = dbNow,
                    WorkingHours = workingHours,
                    Status = status,
                    Latitude = latitude,
                    Longitude = longitude,
                    Accuracy = accuracy,
                    LocationId = locationId,
                    DistanceMeters = distanceMeters
                });

            return (await connection.QuerySingleOrDefaultAsync<Attendance>(
                $@"{BaseSelect} WHERE a.""id"" = @Id", new { Id = existing.Id }))!;
        }

        public async Task<Attendance?> GetTodayRecordAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Attendance>(
                $@"{BaseSelect}
                   WHERE a.""employee_id"" = @EmployeeId AND a.""attendance_date"" = CURRENT_DATE",
                new { EmployeeId = employeeId });
        }

        public async Task<List<Attendance>> GetMyHistoryAsync(int employeeId, DateTime fromDate, DateTime toDate)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var results = await connection.QueryAsync<Attendance>(
                $@"{BaseSelect}
                   WHERE a.""employee_id"" = @EmployeeId
                   AND a.""attendance_date"" >= @FromDate AND a.""attendance_date"" <= @ToDate
                   ORDER BY a.""attendance_date"" DESC",
                new { EmployeeId = employeeId, FromDate = fromDate.Date, ToDate = toDate.Date });
            return results.ToList();
        }

        public async Task<List<Attendance>> GetAllAsync(AttendanceFilterDto filter)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var sql = $@"{BaseSelect} WHERE 1=1";
            var parameters = new DynamicParameters();

            if (filter.FromDate.HasValue)
            {
                sql += @" AND a.""attendance_date"" >= @FromDate";
                parameters.Add("FromDate", filter.FromDate.Value.Date);
            }
            if (filter.ToDate.HasValue)
            {
                sql += @" AND a.""attendance_date"" <= @ToDate";
                parameters.Add("ToDate", filter.ToDate.Value.Date);
            }
            if (filter.EmployeeId.HasValue)
            {
                sql += @" AND a.""employee_id"" = @EmployeeId";
                parameters.Add("EmployeeId", filter.EmployeeId.Value);
            }
            if (!string.IsNullOrWhiteSpace(filter.Department))
            {
                sql += @" AND dep.""Name"" ILIKE @Department";
                parameters.Add("Department", $"%{filter.Department}%");
            }
            if (!string.IsNullOrWhiteSpace(filter.Status))
            {
                sql += @" AND a.""status""::text = @Status";
                parameters.Add("Status", filter.Status);
            }

            sql += @" ORDER BY a.""attendance_date"" DESC, a.""employee_id""";
            var results = await connection.QueryAsync<Attendance>(sql, parameters);
            return results.ToList();
        }

        public async Task<Attendance?> OverrideAsync(
            int id,
            int userId,
            string reason,
            DateTime? checkInUtc,
            DateTime? checkOutUtc,
            decimal? workingHours,
            string status,
            bool isLate)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            var before = await connection.QuerySingleOrDefaultAsync<Attendance>(
                @"SELECT ""id"" AS ""Id"", ""employee_id"" AS ""EmployeeId"", ""attendance_date""::timestamp AS ""AttendanceDate"",
                         ""check_in_time"" AT TIME ZONE 'UTC' AS ""CheckInTime"",
                         ""check_out_time"" AT TIME ZONE 'UTC' AS ""CheckOutTime"",
                         ""working_hours"" AS ""WorkingHours"", ""status""::text AS ""Status"",
                         ""is_late"" AS ""IsLate"",
                         ""missing_punch_detected_at"" AT TIME ZONE 'UTC' AS ""MissingPunchDetectedAt"",
                         ""source"" AS ""Source""
                    FROM ""attendance""
                   WHERE ""id"" = @Id
                     FOR UPDATE",
                new { Id = id },
                transaction);

            if (before == null)
            {
                await transaction.RollbackAsync();
                return null;
            }

            var checkInDb = checkInUtc.HasValue
                ? AsDbTimestamp(checkInUtc.Value)
                : (DateTime?)null;
            var checkOutDb = checkOutUtc.HasValue
                ? AsDbTimestamp(checkOutUtc.Value)
                : (DateTime?)null;

            await connection.ExecuteAsync(
                @"UPDATE ""attendance""
                     SET ""check_in_time"" = @CheckInTime,
                         ""check_out_time"" = @CheckOutTime,
                         ""working_hours"" = @WorkingHours,
                         ""status"" = @Status::attendance_status,
                         ""is_late"" = @IsLate,
                         ""missing_punch_detected_at"" = NULL,
                         ""source"" = 'ADMIN_OVERRIDE',
                         ""updated_at"" = NOW()
                   WHERE ""id"" = @Id",
                new
                {
                    Id = id,
                    CheckInTime = checkInDb,
                    CheckOutTime = checkOutDb,
                    WorkingHours = workingHours,
                    Status = status,
                    IsLate = isLate
                },
                transaction);

            var changed = new List<string>();
            if (before.CheckInTime?.Ticks != checkInUtc?.Ticks) changed.Add("checkInTime");
            if (before.CheckOutTime?.Ticks != checkOutUtc?.Ticks) changed.Add("checkOutTime");
            if (before.WorkingHours != workingHours) changed.Add("workingHours");
            if (!string.Equals(before.Status, status, StringComparison.OrdinalIgnoreCase)) changed.Add("status");
            if (before.IsLate != isLate) changed.Add("isLate");
            if (before.MissingPunchDetectedAt is not null) changed.Add("missingPunchDetectedAt");
            if (!string.Equals(before.Source, "ADMIN_OVERRIDE", StringComparison.OrdinalIgnoreCase)) changed.Add("source");

            var detailsJson = JsonSerializer.Serialize(new
            {
                overrideType = "ADMIN",
                changed
            });
            var beforeJson = JsonSerializer.Serialize(new
            {
                before.CheckInTime,
                before.CheckOutTime,
                before.WorkingHours,
                before.Status,
                before.IsLate,
                before.MissingPunchDetectedAt,
                before.Source
            });
            var afterJson = JsonSerializer.Serialize(new
            {
                CheckInTime = checkInUtc,
                CheckOutTime = checkOutUtc,
                WorkingHours = workingHours,
                Status = status,
                IsLate = isLate,
                MissingPunchDetectedAt = (DateTime?)null,
                Source = "ADMIN_OVERRIDE"
            });

            await connection.ExecuteAsync(
                @"INSERT INTO audit_logs
                      (user_id, action, entity, entity_id, details, reason, source, ""before"", ""after"", at)
                  VALUES
                      (@UserId, 'ATTENDANCE_ADMIN_OVERRIDE', 'attendance', @Id,
                       @Details::jsonb, @Reason, 'ADMIN', @Before::jsonb, @After::jsonb, NOW())",
                new
                {
                    UserId = userId,
                    Id = id,
                    Details = detailsJson,
                    Reason = reason,
                    Before = beforeJson,
                    After = afterJson
                },
                transaction);

            await transaction.CommitAsync();

            return await GetByIdAsync(id);
        }

        public async Task<Attendance?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Attendance>(
                $@"{BaseSelect} WHERE a.""id"" = @Id",
                new { Id = id });
        }

        private static DateTime AsDbTimestamp(DateTime utc)
        {
            return DateTime.SpecifyKind(utc, DateTimeKind.Unspecified);
        }
    }
}
