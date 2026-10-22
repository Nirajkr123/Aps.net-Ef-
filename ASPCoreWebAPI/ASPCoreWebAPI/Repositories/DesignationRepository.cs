using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class DesignationRepository : IDesignationRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public DesignationRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<Designation?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Designation>(
                @"SELECT d.*, dep.""Name"" AS ""DepartmentName""
                  FROM ""Designations"" d
                  JOIN ""Departments"" dep ON d.""DepartmentId"" = dep.""Id""
                  WHERE d.""Id"" = @Id", new { Id = id });
        }

        public async Task<List<Designation>> GetAllAsync(int? departmentId = null)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var sql = @"SELECT d.*, dep.""Name"" AS ""DepartmentName""
                        FROM ""Designations"" d
                        JOIN ""Departments"" dep ON d.""DepartmentId"" = dep.""Id""";

            if (departmentId.HasValue)
            {
                sql += " WHERE d.\"DepartmentId\" = @DepartmentId";
                var results = await connection.QueryAsync<Designation>(sql, new { DepartmentId = departmentId.Value });
                return results.ToList();
            }

            var all = await connection.QueryAsync<Designation>(sql);
            return all.ToList();
        }

        public async Task<int> CreateAsync(Designation designation)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""Designations"" (""Title"", ""DepartmentId"", ""Status"", ""CreatedDate"")
                  VALUES (@Title, @DepartmentId, @Status, @CreatedDate)
                  RETURNING ""Id""",
                designation);
        }

        public async Task<bool> UpdateAsync(Designation designation)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Designations"" SET ""Title"" = @Title, ""DepartmentId"" = @DepartmentId, ""Status"" = @Status
                  WHERE ""Id"" = @Id", designation);
            return rows > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"Designations\" WHERE \"Id\" = @Id", new { Id = id });
            return rows > 0;
        }

        public async Task<bool> ExistsAsync(string title, int departmentId, int? excludeId = null)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            if (excludeId.HasValue)
            {
                return await connection.ExecuteScalarAsync<bool>(
                    "SELECT COUNT(*) > 0 FROM \"Designations\" WHERE \"Title\" = @Title AND \"DepartmentId\" = @DepartmentId AND \"Id\" != @Id",
                    new { Title = title, DepartmentId = departmentId, Id = excludeId.Value });
            }
            return await connection.ExecuteScalarAsync<bool>(
                "SELECT COUNT(*) > 0 FROM \"Designations\" WHERE \"Title\" = @Title AND \"DepartmentId\" = @DepartmentId",
                new { Title = title, DepartmentId = departmentId });
        }
    }
}
