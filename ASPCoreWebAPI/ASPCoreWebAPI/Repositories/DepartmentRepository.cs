using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class DepartmentRepository : IDepartmentRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public DepartmentRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<Department?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Department>(
                @"SELECT d.*, 
                    (SELECT COUNT(*) FROM ""Employees"" e WHERE e.""DepartmentId"" = d.""Id"") AS ""EmployeeCount"",
                    (SELECT COUNT(*) FROM ""Designations"" des WHERE des.""DepartmentId"" = d.""Id"") AS ""DesignationCount""
                  FROM ""Departments"" d WHERE d.""Id"" = @Id", new { Id = id });
        }

        public async Task<List<Department>> GetAllAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var departments = await connection.QueryAsync<Department>(
                @"SELECT d.*, 
                    (SELECT COUNT(*) FROM ""Employees"" e WHERE e.""DepartmentId"" = d.""Id"") AS ""EmployeeCount"",
                    (SELECT COUNT(*) FROM ""Designations"" des WHERE des.""DepartmentId"" = d.""Id"") AS ""DesignationCount""
                  FROM ""Departments"" d ORDER BY d.""Name""");
            return departments.ToList();
        }

        public async Task<int> CreateAsync(Department department)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""Departments"" (""Name"", ""Description"", ""Status"", ""CreatedDate"")
                  VALUES (@Name, @Description, @Status, @CreatedDate)
                  RETURNING ""Id""",
                department);
        }

        public async Task<bool> UpdateAsync(Department department)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Departments"" SET ""Name"" = @Name, ""Description"" = @Description, ""Status"" = @Status
                  WHERE ""Id"" = @Id", department);
            return rows > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"Departments\" WHERE \"Id\" = @Id", new { Id = id });
            return rows > 0;
        }

        public async Task<bool> NameExistsAsync(string name, int? excludeId = null)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            if (excludeId.HasValue)
            {
                return await connection.ExecuteScalarAsync<bool>(
                    "SELECT COUNT(*) > 0 FROM \"Departments\" WHERE \"Name\" = @Name AND \"Id\" != @Id",
                    new { Name = name, Id = excludeId.Value });
            }
            return await connection.ExecuteScalarAsync<bool>(
                "SELECT COUNT(*) > 0 FROM \"Departments\" WHERE \"Name\" = @Name",
                new { Name = name });
        }

        public async Task<List<Dictionary<string, object>>> GetEmployeesByDeptAsync(int deptId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync(
                @"SELECT u.""FirstName"", u.""LastName"", u.""Email"", des.""Title"" AS ""DesignationTitle""
                  FROM ""Employees"" e
                  INNER JOIN ""Users"" u ON e.""UserId"" = u.""Id""
                  LEFT JOIN ""Designations"" des ON e.""DesignationId"" = des.""Id""
                  WHERE e.""DepartmentId"" = @DeptId AND e.""Status"" = 'Active'
                  ORDER BY u.""FirstName""",
                new { DeptId = deptId });
            return rows.Select(r => ((IDictionary<string, object>)r)
                .ToDictionary(kvp => kvp.Key, kvp => kvp.Value ?? (object)"")).ToList();
        }
    }
}
