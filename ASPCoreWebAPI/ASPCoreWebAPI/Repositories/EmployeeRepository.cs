using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class EmployeeRepository : IEmployeeRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public EmployeeRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<Employee?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Employee>(
                @"SELECT e.""Id"", e.""UserId"", e.""EmployeeCode"", e.""Phone"", e.""Address"",
                         e.""FatherName"", e.""MotherName"", e.""Gender"",
                         e.""DOB""::timestamp AS ""DOB"", e.""EmergencyContact"", e.""DepartmentId"", e.""DesignationId"",
                         e.""ManagerId"", e.""EmploymentType"", e.""JoiningDate""::timestamp AS ""JoiningDate"",
                         e.""ExitDate""::timestamp AS ""ExitDate"", e.""WorkLocationId"",
                         wl.""Name"" AS ""WorkLocationName"", e.""Status"", e.""CreatedDate"",
                         e.""ProfileComplete"", e.""ProfilePhotoUrl"",
                         dep.""Name"" AS ""DepartmentName"", des.""Title"" AS ""DesignationTitle"",
                         u.""Email"", u.""FirstName"", u.""LastName"",
                         mu.""FirstName"" || ' ' || mu.""LastName"" AS ""ManagerName"",
                         sh.""ShiftName"", sh.""ShiftTiming""
                  FROM ""Employees"" e
                  LEFT JOIN ""Departments"" dep ON e.""DepartmentId"" = dep.""Id""
                  LEFT JOIN ""Designations"" des ON e.""DesignationId"" = des.""Id""
                  LEFT JOIN ""WorkLocations"" wl ON e.""WorkLocationId"" = wl.""Id""
                  LEFT JOIN ""Users"" u ON e.""UserId"" = u.""Id""
                  LEFT JOIN ""Employees"" mgr ON e.""ManagerId"" = mgr.""Id""
                  LEFT JOIN ""Users"" mu ON mgr.""UserId"" = mu.""Id""
                  LEFT JOIN LATERAL (
                      SELECT s.shift_name AS ""ShiftName"",
                             to_char(s.start_time, 'HH24:MI') || ' – ' ||
                             to_char(s.end_time, 'HH24:MI') AS ""ShiftTiming""
                      FROM shift_assignment sa
                      JOIN shift s ON s.shift_id = sa.shift_id
                      WHERE sa.emp_id = e.""Id""
                        AND COALESCE(sa.status, 'Active') <> 'Cancelled'
                      ORDER BY CASE WHEN sa.shift_date = CURRENT_DATE THEN 0
                                    WHEN sa.shift_date > CURRENT_DATE THEN 1
                                    ELSE 2 END,
                               CASE WHEN sa.shift_date > CURRENT_DATE THEN sa.shift_date END ASC,
                               sa.shift_date DESC
                      LIMIT 1
                  ) sh ON TRUE
                  WHERE e.""Id"" = @Id", new { Id = id });
        }

        public async Task<Employee?> GetByUserIdAsync(int userId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Employee>(
                @"SELECT e.""Id"", e.""UserId"", e.""EmployeeCode"", e.""Phone"", e.""Address"",
                         e.""FatherName"", e.""MotherName"", e.""Gender"",
                         e.""DOB""::timestamp AS ""DOB"", e.""EmergencyContact"", e.""DepartmentId"", e.""DesignationId"",
                         e.""ManagerId"", e.""EmploymentType"", e.""JoiningDate""::timestamp AS ""JoiningDate"",
                         e.""ExitDate""::timestamp AS ""ExitDate"", e.""WorkLocationId"",
                         wl.""Name"" AS ""WorkLocationName"", e.""Status"", e.""CreatedDate"",
                         e.""ProfileComplete"", e.""ProfilePhotoUrl"",
                         dep.""Name"" AS ""DepartmentName"", des.""Title"" AS ""DesignationTitle"",
                         u.""Email"", u.""FirstName"", u.""LastName"",
                         sh.""ShiftName"", sh.""ShiftTiming""
                  FROM ""Employees"" e
                  LEFT JOIN ""Departments"" dep ON e.""DepartmentId"" = dep.""Id""
                  LEFT JOIN ""Designations"" des ON e.""DesignationId"" = des.""Id""
                  LEFT JOIN ""WorkLocations"" wl ON e.""WorkLocationId"" = wl.""Id""
                  LEFT JOIN ""Users"" u ON e.""UserId"" = u.""Id""
                  LEFT JOIN LATERAL (
                      SELECT s.shift_name AS ""ShiftName"",
                             to_char(s.start_time, 'HH24:MI') || ' – ' ||
                             to_char(s.end_time, 'HH24:MI') AS ""ShiftTiming""
                      FROM shift_assignment sa
                      JOIN shift s ON s.shift_id = sa.shift_id
                      WHERE sa.emp_id = e.""Id""
                        AND COALESCE(sa.status, 'Active') <> 'Cancelled'
                      ORDER BY CASE WHEN sa.shift_date = CURRENT_DATE THEN 0
                                    WHEN sa.shift_date > CURRENT_DATE THEN 1
                                    ELSE 2 END,
                               CASE WHEN sa.shift_date > CURRENT_DATE THEN sa.shift_date END ASC,
                               sa.shift_date DESC
                      LIMIT 1
                  ) sh ON TRUE
                  WHERE e.""UserId"" = @UserId", new { UserId = userId });
        }

        public async Task<List<Employee>> GetAllAsync(int? departmentId = null, int? designationId = null, string? status = null, string? search = null, bool? profileComplete = null)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var sql = @"SELECT e.""Id"", e.""UserId"", e.""EmployeeCode"", e.""Phone"", e.""Address"",
                               e.""FatherName"", e.""MotherName"", e.""Gender"",
                               e.""DOB""::timestamp AS ""DOB"", e.""EmergencyContact"", e.""DepartmentId"", e.""DesignationId"",
                               e.""ManagerId"", e.""EmploymentType"", e.""JoiningDate""::timestamp AS ""JoiningDate"",
                               e.""ExitDate""::timestamp AS ""ExitDate"", e.""WorkLocationId"",
                               wl.""Name"" AS ""WorkLocationName"", e.""Status"", e.""CreatedDate"",
                               e.""ProfileComplete"", e.""ProfilePhotoUrl"",
                               dep.""Name"" AS ""DepartmentName"", des.""Title"" AS ""DesignationTitle"",
                               u.""Email"", u.""FirstName"", u.""LastName"",
                               mu.""FirstName"" || ' ' || mu.""LastName"" AS ""ManagerName"",
                               sh.""ShiftName"", sh.""ShiftTiming""
                        FROM ""Employees"" e
                        LEFT JOIN ""Departments"" dep ON e.""DepartmentId"" = dep.""Id""
                        LEFT JOIN ""Designations"" des ON e.""DesignationId"" = des.""Id""
                        LEFT JOIN ""WorkLocations"" wl ON e.""WorkLocationId"" = wl.""Id""
                        LEFT JOIN ""Users"" u ON e.""UserId"" = u.""Id""
                        LEFT JOIN ""Employees"" mgr ON e.""ManagerId"" = mgr.""Id""
                        LEFT JOIN ""Users"" mu ON mgr.""UserId"" = mu.""Id""
                        LEFT JOIN LATERAL (
                            SELECT s.shift_name AS ""ShiftName"",
                                   to_char(s.start_time, 'HH24:MI') || ' – ' ||
                                   to_char(s.end_time, 'HH24:MI') AS ""ShiftTiming""
                            FROM shift_assignment sa
                            JOIN shift s ON s.shift_id = sa.shift_id
                            WHERE sa.emp_id = e.""Id""
                              AND COALESCE(sa.status, 'Active') <> 'Cancelled'
                            ORDER BY CASE WHEN sa.shift_date = CURRENT_DATE THEN 0
                                          WHEN sa.shift_date > CURRENT_DATE THEN 1
                                          ELSE 2 END,
                                     CASE WHEN sa.shift_date > CURRENT_DATE THEN sa.shift_date END ASC,
                                     sa.shift_date DESC
                            LIMIT 1
                        ) sh ON TRUE
                        WHERE 1=1";

            var parameters = new DynamicParameters();

            if (departmentId.HasValue)
            {
                sql += " AND e.\"DepartmentId\" = @DepartmentId";
                parameters.Add("DepartmentId", departmentId.Value);
            }
            if (designationId.HasValue)
            {
                sql += " AND e.\"DesignationId\" = @DesignationId";
                parameters.Add("DesignationId", designationId.Value);
            }
            if (!string.IsNullOrWhiteSpace(status))
            {
                sql += " AND e.\"Status\" = @Status";
                parameters.Add("Status", status);
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                sql += " AND (u.\"FirstName\" ILIKE @Search OR u.\"LastName\" ILIKE @Search OR u.\"Email\" ILIKE @Search OR e.\"EmployeeCode\" ILIKE @Search)";
                parameters.Add("Search", $"%{search}%");
            }
            if (profileComplete.HasValue)
            {
                sql += " AND e.\"ProfileComplete\" = @ProfileComplete";
                parameters.Add("ProfileComplete", profileComplete.Value);
            }

            sql += " ORDER BY e.\"CreatedDate\" DESC";
            var results = await connection.QueryAsync<Employee>(sql, parameters);
            return results.ToList();
        }

        public async Task<int> CreateAsync(Employee employee)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""Employees"" (""UserId"", ""EmployeeCode"", ""Phone"", ""Address"", ""DOB"", ""EmergencyContact"",
                  ""DepartmentId"", ""DesignationId"", ""ManagerId"", ""EmploymentType"", ""JoiningDate"",
                  ""WorkLocationId"", ""ExitDate"", ""ProfileComplete"", ""Status"", ""CreatedDate"")
                  VALUES (@UserId, @EmployeeCode, @Phone, @Address, @DOB, @EmergencyContact,
                  @DepartmentId, @DesignationId, @ManagerId, @EmploymentType, @JoiningDate,
                  @WorkLocationId, @ExitDate, @ProfileComplete, @Status, @CreatedDate)
                  RETURNING ""Id""",
                new { employee.UserId, employee.EmployeeCode, employee.Phone, employee.Address,
                      DOB = employee.DOB, employee.EmergencyContact, employee.DepartmentId, employee.DesignationId,
                      employee.ManagerId, employee.EmploymentType, JoiningDate = employee.JoiningDate,
                      employee.WorkLocationId, ExitDate = employee.ExitDate,
                      employee.ProfileComplete, employee.Status, employee.CreatedDate });
        }

        public async Task<bool> UpdateAsync(Employee employee)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Employees"" SET ""Phone"" = @Phone, ""Address"" = @Address, ""DOB"" = @DOB,
                  ""EmergencyContact"" = @EmergencyContact, ""DepartmentId"" = @DepartmentId,
                  ""DesignationId"" = @DesignationId, ""ManagerId"" = @ManagerId,
                  ""EmploymentType"" = @EmploymentType, ""JoiningDate"" = @JoiningDate,
                  ""WorkLocationId"" = @WorkLocationId, ""ExitDate"" = @ExitDate,
                  ""ProfileComplete"" = @ProfileComplete, ""Status"" = @Status
                  WHERE ""Id"" = @Id",
                new { employee.Id, employee.Phone, employee.Address, DOB = employee.DOB,
                      employee.EmergencyContact, employee.DepartmentId, employee.DesignationId,
                      employee.ManagerId, employee.EmploymentType, JoiningDate = employee.JoiningDate,
                      employee.WorkLocationId, ExitDate = employee.ExitDate,
                      employee.ProfileComplete, employee.Status });
            return rows > 0;
        }

        public async Task<bool> UpdateProfileAsync(int id, string phone, string address, string emergencyContact, bool profileComplete)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Employees"" SET ""Phone"" = @Phone, ""Address"" = @Address,
                  ""EmergencyContact"" = @EmergencyContact, ""ProfileComplete"" = @ProfileComplete
                  WHERE ""Id"" = @Id",
                new { Id = id, Phone = phone, Address = address, EmergencyContact = emergencyContact, ProfileComplete = profileComplete });
            return rows > 0;
        }

        public async Task<bool> UpdateProfileFullAsync(int id, string phone, string address, string emergencyContact,
            string? fatherName, string? motherName, string? gender, DateTime? dob, bool profileComplete)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Employees"" SET ""Phone"" = @Phone, ""Address"" = @Address,
                  ""EmergencyContact"" = @EmergencyContact, ""FatherName"" = @FatherName,
                  ""MotherName"" = @MotherName, ""Gender"" = @Gender, ""DOB"" = @DOB,
                  ""ProfileComplete"" = @ProfileComplete
                  WHERE ""Id"" = @Id",
                new { Id = id, Phone = phone, Address = address, EmergencyContact = emergencyContact,
                      FatherName = fatherName, MotherName = motherName, Gender = gender, DOB = dob,
                      ProfileComplete = profileComplete });
            return rows > 0;
        }

        public async Task<bool> DeactivateAsync(int id, DateTime? exitDate)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Employees""
                     SET ""Status"" = 'Inactive',
                         ""ExitDate"" = @ExitDate
                   WHERE ""Id"" = @Id",
                new { Id = id, ExitDate = exitDate });
            return rows > 0;
        }

        public async Task<bool> ActivateAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            /* Reactivate par purana ExitDate clear — warna register us
               employee ko phir se exited dikhata rahega. */
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Employees""
                     SET ""Status"" = 'Active',
                         ""ExitDate"" = NULL
                   WHERE ""Id"" = @Id", new { Id = id });
            return rows > 0;
        }

        public async Task<bool> UpdateProfilePhotoAsync(int id, string profilePhotoUrl)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Employees"" SET ""ProfilePhotoUrl"" = @ProfilePhotoUrl WHERE ""Id"" = @Id",
                new { Id = id, ProfilePhotoUrl = profilePhotoUrl });
            return rows > 0;
        }

        public async Task<string> GenerateEmployeeCodeAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var maxId = await connection.ExecuteScalarAsync<int?>("SELECT MAX(\"Id\") FROM \"Employees\"");
            return $"EMP{(maxId + 1):D4}";
        }

        public async Task<int> CountAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM \"Employees\"");
        }

        public async Task<int> CountIncompleteProfilesAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM \"Employees\" WHERE \"ProfileComplete\" = false AND \"Status\" = 'Active'");
        }
    }
}
