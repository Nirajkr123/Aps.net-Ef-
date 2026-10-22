using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class NotificationRepository : INotificationRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public NotificationRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string BaseSelect = @"
            SELECT n.""id"" AS ""Id"", n.""user_id"" AS ""UserId"", n.""employee_id"" AS ""EmployeeId"",
                   n.""type""::text AS ""Type"", n.""title"" AS ""Title"", n.""message"" AS ""Message"",
                   n.""link"" AS ""Link"", n.""is_read"" AS ""IsRead"", n.""read_at"" AS ""ReadAt"",
                   n.""created_at"" AS ""CreatedAt""
            FROM ""notifications"" n";

        public async Task<List<Notification>> GetByUserIdAsync(int userId, int limit, int offset)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var results = await connection.QueryAsync<Notification>(
                $@"{BaseSelect}
                   WHERE n.""user_id"" = @UserId
                   ORDER BY n.""created_at"" DESC, n.""id"" DESC
                   LIMIT @Limit OFFSET @Offset",
                new { UserId = userId, Limit = limit, Offset = offset });
            return results.ToList();
        }

        public async Task<int> GetUnreadCountAsync(int userId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                @"SELECT COUNT(*) FROM ""notifications"" WHERE ""user_id"" = @UserId AND ""is_read"" = FALSE",
                new { UserId = userId });
        }

        public async Task<int> MarkReadAsync(int userId, int[] ids)
        {
            if (ids.Length == 0) return 0;

            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteAsync(
                @"UPDATE ""notifications""
                   SET ""is_read"" = TRUE, ""read_at"" = NOW()
                   WHERE ""user_id"" = @UserId AND ""is_read"" = FALSE AND ""id"" = ANY(@Ids)",
                new { UserId = userId, Ids = ids });
        }

        public async Task<int> MarkAllReadAsync(int userId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteAsync(
                @"UPDATE ""notifications""
                   SET ""is_read"" = TRUE, ""read_at"" = NOW()
                   WHERE ""user_id"" = @UserId AND ""is_read"" = FALSE",
                new { UserId = userId });
        }

        public async Task CreateManyAsync(IEnumerable<CreateNotificationDto> notifications)
        {
            var list = notifications.ToList();
            if (list.Count == 0) return;

            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"INSERT INTO ""notifications"" (""user_id"", ""employee_id"", ""type"", ""title"", ""message"", ""link"")
                  VALUES (@UserId, @EmployeeId, @Type::notification_type, @Title, @Message, @Link)",
                list);
        }

        public async Task<List<int>> GetAdminUserIdsAsync(int excludeUserId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var ids = await connection.QueryAsync<int>(
                @"SELECT ""Id"" FROM ""Users""
                   WHERE ""Role"" IN ('OWNER', 'HR')
                     AND ""Status"" = 'Active'
                     AND ""Id"" <> @ExcludeUserId",
                new { ExcludeUserId = excludeUserId });
            return ids.ToList();
        }

        public async Task<List<int>> GetActiveEmployeeUserIdsAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var ids = await connection.QueryAsync<int>(
                @"SELECT e.""UserId""
                   FROM ""Employees"" e
                   JOIN ""Users"" u ON u.""Id"" = e.""UserId""
                   WHERE e.""Status"" = 'Active' AND u.""Status"" = 'Active'");
            return ids.ToList();
        }

        public async Task SaveFcmTokenAsync(int userId, string token, string? userAgent)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"INSERT INTO ""fcm_tokens"" (""user_id"", ""token"", ""user_agent"")
                  VALUES (@UserId, @Token, @UserAgent)
                  ON CONFLICT (""token"") DO UPDATE
                  SET ""user_id"" = EXCLUDED.""user_id"",
                      ""user_agent"" = EXCLUDED.""user_agent"",
                      ""updated_at"" = NOW()",
                new { UserId = userId, Token = token, UserAgent = userAgent });
        }

        public async Task RemoveFcmTokenAsync(int userId, string token)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"DELETE FROM ""fcm_tokens"" WHERE ""user_id"" = @UserId AND ""token"" = @Token",
                new { UserId = userId, Token = token });
        }

        public async Task RemoveFcmTokensAsync(IEnumerable<string> tokens)
        {
            var list = tokens.ToList();
            if (list.Count == 0) return;

            using var connection = await _dataSource.OpenConnectionAsync();
            await connection.ExecuteAsync(
                @"DELETE FROM ""fcm_tokens"" WHERE ""token"" = ANY(@Tokens)",
                new { Tokens = list });
        }

        public async Task<List<string>> GetFcmTokensByUserIdsAsync(IEnumerable<int> userIds)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0) return new List<string>();

            using var connection = await _dataSource.OpenConnectionAsync();
            var tokens = await connection.QueryAsync<string>(
                @"SELECT ""token"" FROM ""fcm_tokens"" WHERE ""user_id"" = ANY(@UserIds)",
                new { UserIds = ids });
            return tokens.ToList();
        }
    }
}
