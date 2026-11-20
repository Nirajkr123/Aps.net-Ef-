using System.Data;
using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public UserRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string Columns =
            "\"Id\", \"FirstName\", \"LastName\", \"Email\", \"Password\", \"Role\", \"StateId\", \"DistrictId\", \"Status\", \"LastLogin\", \"CreatedDate\", \"FirebaseUid\"";

        private static readonly Func<User, User> MapUser = _ => _;

        public async Task<User?> GetByEmailAsync(string email)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QueryFirstOrDefaultAsync<User>(
                $"SELECT {Columns} FROM \"Users\" WHERE \"Email\" = @Email",
                new { Email = email });
        }

        public async Task<User?> GetByFirebaseUidAsync(string firebaseUid)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QueryFirstOrDefaultAsync<User>(
                $"SELECT {Columns} FROM \"Users\" WHERE \"FirebaseUid\" = @FirebaseUid",
                new { FirebaseUid = firebaseUid });
        }

        public async Task<int> CreateAsync(User user)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var sql = @"
                INSERT INTO ""Users"" (""FirstName"", ""LastName"", ""Email"", ""Password"", ""Role"", ""StateId"", ""DistrictId"", ""Status"", ""LastLogin"", ""CreatedDate"", ""FirebaseUid"")
                VALUES (@FirstName, @LastName, @Email, @Password, @Role, @StateId, @DistrictId, @Status, @LastLogin, @CreatedDate, @FirebaseUid)
                RETURNING ""Id"";";
            return await connection.ExecuteScalarAsync<int>(sql, user);
        }

        public async Task<User?> GetByIdAsync(int id)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QueryFirstOrDefaultAsync<User>(
                $"SELECT {Columns} FROM \"Users\" WHERE \"Id\" = @Id",
                new { Id = id });
        }

        public async Task<bool> DeleteAsync(int id)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"Users\" WHERE \"Id\" = @Id",
                new { Id = id });
            return rows > 0;
        }

        public async Task<bool> UpdateAsync(User user)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Users""
                  SET ""FirstName"" = @FirstName, ""LastName"" = @LastName, ""Email"" = @Email,
                      ""Role"" = @Role, ""StateId"" = @StateId, ""DistrictId"" = @DistrictId,
                      ""Status"" = @Status
                  WHERE ""Id"" = @Id",
                new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.Role,
                    user.StateId,
                    user.DistrictId,
                    user.Status
                });
            return rows > 0;
        }

        public async Task<bool> UpdateLastLoginAsync(int id, DateTime lastLogin)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "UPDATE \"Users\" SET \"LastLogin\" = @LastLogin WHERE \"Id\" = @Id",
                new { Id = id, LastLogin = lastLogin });
            return rows > 0;
        }

        public async Task<bool> UpdateStatusAsync(int id, string status)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "UPDATE \"Users\" SET \"Status\" = @Status WHERE \"Id\" = @Id",
                new { Id = id, Status = status });
            return rows > 0;
        }

        public async Task<bool> UpdateRoleAsync(int id, string role)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "UPDATE \"Users\" SET \"Role\" = @Role WHERE \"Id\" = @Id",
                new { Id = id, Role = role });
            return rows > 0;
        }

        public async Task<bool> UpdatePasswordAsync(int id, string passwordHash)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "UPDATE \"Users\" SET \"Password\" = @Password WHERE \"Id\" = @Id",
                new { Id = id, Password = passwordHash });
            return rows > 0;
        }

        public async Task<bool> UpdateFirebaseUidAsync(int id, string firebaseUid)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "UPDATE \"Users\" SET \"FirebaseUid\" = @FirebaseUid WHERE \"Id\" = @Id",
                new { Id = id, FirebaseUid = firebaseUid });
            return rows > 0;
        }

        public async Task<List<User>> GetAllManagedAsync()
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var result = await connection.QueryAsync<User>(
                @"SELECT u.""Id"", u.""FirstName"", u.""LastName"", u.""Email"", u.""Role"",
                        u.""StateId"", u.""DistrictId"", u.""Status"", u.""LastLogin"", u.""CreatedDate"",
                        s.""Name"" AS ""StateName"", d.""Name"" AS ""DistrictName""
                  FROM ""Users"" u
                  LEFT JOIN ""States"" s ON s.""Id"" = u.""StateId""
                  LEFT JOIN ""Districts"" d ON d.""Id"" = u.""DistrictId""
                  WHERE u.""Role"" <> 'EMPLOYEE'
                  ORDER BY u.""CreatedDate"" DESC");
            return result.AsList();
        }

        public async Task<int> CountTotalAsync()
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM \"Users\"");
        }

        public async Task<int> CountTodayAsync(DateTime start, DateTime end)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM \"Users\" WHERE \"CreatedDate\" >= @start AND \"CreatedDate\" < @end",
                new { start, end });
        }

        public async Task<int> CountSinceAsync(DateTime start)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM \"Users\" WHERE \"CreatedDate\" >= @start",
                new { start });
        }

        public async Task<int> CountRangeAsync(DateTime start, DateTime end)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM \"Users\" WHERE \"CreatedDate\" >= @start AND \"CreatedDate\" < @end",
                new { start, end });
        }

        public async Task<List<User>> GetAllAsync()
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var result = await connection.QueryAsync<User>(
                $"SELECT {Columns} FROM \"Users\"");
            return result.AsList();
        }

        public async Task<Dictionary<string, int>> RoleBreakdownAsync()
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync(
                @"SELECT COALESCE(NULLIF(""Role"", ''), 'User') AS role, COUNT(*) AS count
                  FROM ""Users""
                  GROUP BY COALESCE(NULLIF(""Role"", ''), 'User')");
            return rows.ToDictionary(r => (string)r.role, r => (int)r.count);
        }
    }
}
