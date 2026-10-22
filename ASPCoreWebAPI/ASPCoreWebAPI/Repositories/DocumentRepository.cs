using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class DocumentRepository : IDocumentRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public DocumentRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<Document?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Document>(
                "SELECT * FROM \"Documents\" WHERE \"Id\" = @Id", new { Id = id });
        }

        public async Task<List<Document>> GetByEmployeeIdAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var docs = await connection.QueryAsync<Document>(
                "SELECT * FROM \"Documents\" WHERE \"EmployeeId\" = @EmployeeId ORDER BY \"UploadedAt\" DESC",
                new { EmployeeId = employeeId });
            return docs.ToList();
        }

        public async Task<int> CreateAsync(Document document)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""Documents"" (""EmployeeId"", ""Type"", ""FileName"", ""FilePath"", ""UploadedAt"")
                  VALUES (@EmployeeId, @Type, @FileName, @FilePath, @UploadedAt)
                  RETURNING ""Id""",
                document);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"Documents\" WHERE \"Id\" = @Id", new { Id = id });
            return rows > 0;
        }
    }
}
