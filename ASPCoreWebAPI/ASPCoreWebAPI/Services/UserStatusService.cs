using System.Collections.Concurrent;
using Dapper;
using Microsoft.Extensions.Caching.Memory;
using Npgsql;

namespace ASPCoreWebAPI.Services
{
    public interface IUserStatusService
    {
        Task<bool> IsActiveAsync(int userId, CancellationToken cancellationToken);
    }

    public sealed class UserStatusService : IUserStatusService
    {
        private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(30);

        private readonly NpgsqlDataSource _dataSource;
        private readonly IMemoryCache _cache;
        private readonly ConcurrentDictionary<int, Lazy<Task<bool>>> _inFlight = new();

        public UserStatusService(NpgsqlDataSource dataSource, IMemoryCache cache)
        {
            _dataSource = dataSource;
            _cache = cache;
        }

        public async Task<bool> IsActiveAsync(int userId, CancellationToken cancellationToken)
        {
            var cacheKey = $"user-status:{userId}";
            if (_cache.TryGetValue(cacheKey, out bool cached))
                return cached;

            var lazy = _inFlight.GetOrAdd(
                userId,
                id => new Lazy<Task<bool>>(
                    () => LoadStatusAsync(id),
                    LazyThreadSafetyMode.ExecutionAndPublication));

            try
            {
                var isActive = await lazy.Value.WaitAsync(cancellationToken);
                _cache.Set(cacheKey, isActive, CacheDuration);
                return isActive;
            }
            finally
            {
                _inFlight.TryRemove(
                    new KeyValuePair<int, Lazy<Task<bool>>>(userId, lazy));
            }
        }

        private async Task<bool> LoadStatusAsync(int userId)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var status = await connection.ExecuteScalarAsync<string?>(
                "SELECT \"Status\" FROM \"Users\" WHERE \"Id\" = @UserId",
                new { UserId = userId });

            return string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase);
        }
    }
}
