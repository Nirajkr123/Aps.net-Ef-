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
                   a.""check_in_time"" AS ""CheckInTime"", a.""check_out_time"" AS ""CheckOutTime"",
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
                   a.""created_at"" AS ""CreatedAt"", a.""updated_at"" AS ""UpdatedAt"",
                   COALESCE(wl_in.""Name"", a.""check_in_location_name"") AS ""CheckInLocationName"",
                   COALESCE(wl_out.""Name"", a.""check_out_location_name"") AS ""CheckOutLocationName"",
                   COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''), 'Unknown') AS ""EmployeeName"",
                   COALESCE(e.""EmployeeCode"", '') AS ""EmployeeCode"",
                   COALESCE(u.""Email"", '') AS ""EmployeeEmail"",
                   COALESCE(dep.""Name"", '') AS ""Department""
             FROM ""attendance"" a
             LEFT JOIN ""Employees"" e ON a.""employee_id"" = e.""Id""
             LEFT JOIN ""Users"" u ON e.""UserId"" = u.""Id""
             LEFT JOIN ""Departments"" dep ON e.""DepartmentId"" = dep.""Id""
             LEFT JOIN ""WorkLocations"" wl_in ON a.""check_in_location_id"" = wl_in.""Id""
             LEFT JOIN ""WorkLocations"" wl_out ON a.""check_out_location_id"" = wl_out.""Id""";

        public async Task<Attendance> CheckInAsync(
            int employeeId,
            double latitude,
            double longitude,
            double accuracy,
            int locationId,
            double distanceMeters,
            string? ip)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var now = DateTime.UtcNow;

            var existingId = await connection.QuerySingleOrDefaultAsync<int?>(
                @"SELECT ""id"" FROM ""attendance""
                   WHERE ""employee_id"" = @EmployeeId AND ""attendance_date"" = CURRENT_DATE",
                new { EmployeeId = employeeId });

            if (existingId.HasValue)
                throw new InvalidOperationException("Already checked in today.");

            var shiftStart = new TimeSpan(9, 30, 0);
            var graceMinutes = 15;
            var isLate = now.TimeOfDay > shiftStart.Add(TimeSpan.FromMinutes(graceMinutes));

            var id = await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""attendance""
                       (""employee_id"", ""attendance_date"", ""check_in_time"", ""status"", ""is_late"",
                        ""ip_address"", ""check_in_latitude"", ""check_in_longitude"", ""check_in_accuracy"",
                        ""check_in_location_id"", ""check_in_distance_meters"")
                   VALUES (@EmployeeId, CURRENT_DATE, CURRENT_TIMESTAMP, @Status::attendance_status, @IsLate,
                           @Ip, @Latitude, @Longitude, @Accuracy, @LocationId, @DistanceMeters)
                   RETURNING ""id""",
                new
                {
                    EmployeeId = employeeId,
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
            double distanceMeters)
        {
            using var connection = await _dataSource.OpenConnectionAsync();

            var existing = await connection.QuerySingleOrDefaultAsync<Attendance>(
                @"SELECT ""id"" AS ""Id"", ""employee_id"" AS ""EmployeeId"", ""attendance_date""::timestamp AS ""AttendanceDate"",
                         ""check_in_time"" AS ""CheckInTime"", ""check_out_time"" AS ""CheckOutTime"",
                         ""working_hours"" AS ""WorkingHours"", ""status""::text AS ""Status"",
                         ""is_late"" AS ""IsLate"", ""location"" AS ""Location"", ""ip_address"" AS ""IpAddress"",
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
                  SET ""check_out_time"" = CURRENT_TIMESTAMP,
                      ""working_hours"" = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ""check_in_time"")) / 3600.0, 2),
                      ""status"" = CASE
                          WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ""check_in_time"")) / 3600.0 >= 8 THEN 'Present'::attendance_status
                          WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ""check_in_time"")) / 3600.0 >= 4 THEN 'Half-day'::attendance_status
                          ELSE 'Absent'::attendance_status
                      END,
                      ""check_out_latitude"" = @Latitude,
                      ""check_out_longitude"" = @Longitude,
                      ""check_out_accuracy"" = @Accuracy,
                      ""check_out_location_id"" = @LocationId,
                      ""check_out_distance_meters"" = @DistanceMeters
                  WHERE ""id"" = @Id",
                new
                {
                    Id = existing.Id,
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

        public async Task<Attendance?> UpdateAsync(int id, AttendanceUpdateDto dto)
        {
            using var connection = await _dataSource.OpenConnectionAsync();

            var existing = await connection.QuerySingleOrDefaultAsync<Attendance>(
                @"SELECT ""id"" FROM ""attendance"" WHERE ""id"" = @Id", new { Id = id });
            if (existing == null) return null;

            var setClauses = new List<string>();
            var parameters = new DynamicParameters();
            parameters.Add("Id", id);

            if (dto.CheckInTime.HasValue)
            {
                setClauses.Add(@"""check_in_time"" = @CheckInTime");
                parameters.Add("CheckInTime", dto.CheckInTime.Value);
            }
            if (dto.CheckOutTime.HasValue)
            {
                setClauses.Add(@"""check_out_time"" = @CheckOutTime");
                parameters.Add("CheckOutTime", dto.CheckOutTime.Value);
            }
            if (!string.IsNullOrWhiteSpace(dto.Status))
            {
                setClauses.Add(@"""status"" = @Status::attendance_status");
                parameters.Add("Status", dto.Status);
            }

            if (setClauses.Count == 0)
                return await GetByIdAsync(id);

            var sql = $@"UPDATE ""attendance"" SET {string.Join(", ", setClauses)} WHERE ""id"" = @Id";
            await connection.ExecuteAsync(sql, parameters);

            return await GetByIdAsync(id);
        }

        public async Task<Attendance?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Attendance>(
                $@"{BaseSelect} WHERE a.""id"" = @Id",
                new { Id = id });
        }
    }
}
