using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class DistrictRepository : IDistrictRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public DistrictRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<List<District>> GetAllAsync()
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var result = await connection.QueryAsync<District>(
                "SELECT \"Id\", \"StateId\", \"Name\" FROM \"Districts\" ORDER BY \"Name\"");
            return result.AsList();
        }

        public async Task<List<District>> GetByStateAsync(int stateId)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var result = await connection.QueryAsync<District>(
                "SELECT \"Id\", \"StateId\", \"Name\" FROM \"Districts\" WHERE \"StateId\" = @StateId ORDER BY \"Name\"",
                new { StateId = stateId });
            return result.AsList();
        }

        public async Task<District?> GetByIdAsync(int id)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QueryFirstOrDefaultAsync<District>(
                "SELECT \"Id\", \"StateId\", \"Name\" FROM \"Districts\" WHERE \"Id\" = @Id",
                new { Id = id });
        }

        public async Task<int> CreateAsync(District district)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var sql = @"
                INSERT INTO ""Districts"" (""StateId"", ""Name"")
                VALUES (@StateId, @Name)
                RETURNING ""Id"";";
            return await connection.ExecuteScalarAsync<int>(sql, new { district.StateId, district.Name });
        }

        public async Task<bool> UpdateAsync(District district)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "UPDATE \"Districts\" SET \"StateId\" = @StateId, \"Name\" = @Name WHERE \"Id\" = @Id",
                new { district.Id, district.StateId, district.Name });
            return rows > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"Districts\" WHERE \"Id\" = @Id",
                new { Id = id });
            return rows > 0;
        }
    }
}
