using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public interface IWorkLocationRepository
    {
        Task<List<WorkLocation>> GetAllAsync();
        Task<List<WorkLocation>> GetActiveAsync();
        Task<WorkLocation?> GetByIdAsync(int id);
        Task<WorkLocation> CreateAsync(WorkLocationRequest request);
        Task<WorkLocation?> UpdateAsync(int id, WorkLocationRequest request);
        Task<WorkLocation?> SetActiveAsync(int id, bool isActive);
    }

    public class WorkLocationRepository : IWorkLocationRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public WorkLocationRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string BaseSelect = @"
            SELECT ""Id"" AS ""Id"", ""Name"" AS ""Name"", ""Latitude"" AS ""Latitude"",
                   ""Longitude"" AS ""Longitude"", ""RadiusMeters"" AS ""RadiusMeters"",
                   ""IsActive"" AS ""IsActive"", ""CreatedAt"" AS ""CreatedAt"",
                   ""UpdatedAt"" AS ""UpdatedAt""
            FROM ""WorkLocations""";

        public async Task<List<WorkLocation>> GetAllAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<WorkLocation>(
                $@"{BaseSelect} ORDER BY ""IsActive"" DESC, ""Name""");
            return rows.ToList();
        }

        public async Task<List<WorkLocation>> GetActiveAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<WorkLocation>(
                $@"{BaseSelect} WHERE ""IsActive"" = TRUE ORDER BY ""Name""");
            return rows.ToList();
        }

        public async Task<WorkLocation?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<WorkLocation>(
                $@"{BaseSelect} WHERE ""Id"" = @Id", new { Id = id });
        }

        public async Task<WorkLocation> CreateAsync(WorkLocationRequest request)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var id = await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""WorkLocations""
                      (""Name"", ""Latitude"", ""Longitude"", ""RadiusMeters"", ""IsActive"")
                  VALUES (@Name, @Latitude, @Longitude, @RadiusMeters, TRUE)
                  RETURNING ""Id""",
                new
                {
                    Name = request.Name!.Trim(),
                    Latitude = request.Latitude!.Value,
                    Longitude = request.Longitude!.Value,
                    RadiusMeters = request.RadiusMeters ?? 100
                });

            return (await GetByIdAsync(id))!;
        }

        public async Task<WorkLocation?> UpdateAsync(int id, WorkLocationRequest request)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var updated = await connection.ExecuteAsync(
                @"UPDATE ""WorkLocations""
                  SET ""Name"" = @Name,
                      ""Latitude"" = @Latitude,
                      ""Longitude"" = @Longitude,
                      ""RadiusMeters"" = @RadiusMeters,
                      ""UpdatedAt"" = NOW()
                  WHERE ""Id"" = @Id",
                new
                {
                    Id = id,
                    Name = request.Name!.Trim(),
                    Latitude = request.Latitude!.Value,
                    Longitude = request.Longitude!.Value,
                    RadiusMeters = request.RadiusMeters ?? 100
                });

            return updated == 0 ? null : await GetByIdAsync(id);
        }

        public async Task<WorkLocation?> SetActiveAsync(int id, bool isActive)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var updated = await connection.ExecuteAsync(
                @"UPDATE ""WorkLocations""
                  SET ""IsActive"" = @IsActive, ""UpdatedAt"" = NOW()
                  WHERE ""Id"" = @Id",
                new { Id = id, IsActive = isActive });

            return updated == 0 ? null : await GetByIdAsync(id);
        }
    }
}
