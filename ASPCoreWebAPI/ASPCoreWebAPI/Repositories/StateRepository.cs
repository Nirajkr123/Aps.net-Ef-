using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class StateRepository : IStateRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public StateRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<List<State>> GetAllAsync()
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var result = await connection.QueryAsync<State>(
                "SELECT \"Id\", \"Name\" FROM \"States\" ORDER BY \"Name\"");
            return result.AsList();
        }

        public async Task<State?> GetByIdAsync(int id)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QueryFirstOrDefaultAsync<State>(
                "SELECT \"Id\", \"Name\" FROM \"States\" WHERE \"Id\" = @Id",
                new { Id = id });
        }

        public async Task<int> CreateAsync(State state)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var sql = @"
                INSERT INTO ""States"" (""Name"")
                VALUES (@Name)
                RETURNING ""Id"";";
            return await connection.ExecuteScalarAsync<int>(sql, new { state.Name });
        }

        public async Task<bool> UpdateAsync(State state)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "UPDATE \"States\" SET \"Name\" = @Name WHERE \"Id\" = @Id",
                new { state.Id, state.Name });
            return rows > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"States\" WHERE \"Id\" = @Id",
                new { Id = id });
            return rows > 0;
        }
    }
}
