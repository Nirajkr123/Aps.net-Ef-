using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class EducationRepository : IEducationRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public EducationRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<List<Education>> GetByEmployeeIdAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<Education>(
                @"SELECT * FROM ""Education"" WHERE ""EmployeeId"" = @EmployeeId ORDER BY ""Level"", ""YearOfPassing"" DESC",
                new { EmployeeId = employeeId });
            return rows.ToList();
        }

        public async Task<Education?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Education>(
                "SELECT * FROM \"Education\" WHERE \"Id\" = @Id", new { Id = id });
        }

        public async Task<int> CreateAsync(Education education)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""Education"" (""EmployeeId"", ""Level"", ""Institution"", ""Board"", ""YearOfPassing"", ""Percentage"", ""CGPA"", ""DocumentUrl"", ""CreatedDate"")
                  VALUES (@EmployeeId, @Level, @Institution, @Board, @YearOfPassing, @Percentage, @CGPA, @DocumentUrl, @CreatedDate)
                  RETURNING ""Id""", education);
        }

        public async Task<bool> UpdateAsync(Education education)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"UPDATE ""Education"" SET ""Level"" = @Level, ""Institution"" = @Institution, ""Board"" = @Board,
                  ""YearOfPassing"" = @YearOfPassing, ""Percentage"" = @Percentage, ""CGPA"" = @CGPA, ""DocumentUrl"" = @DocumentUrl
                  WHERE ""Id"" = @Id", education);
            return rows > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"Education\" WHERE \"Id\" = @Id", new { Id = id });
            return rows > 0;
        }
    }

    public class EmployeeDocumentRepository : IEmployeeDocumentRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public EmployeeDocumentRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public async Task<List<EmployeeDocument>> GetByEmployeeIdAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<EmployeeDocument>(
                @"SELECT * FROM ""EmployeeDocuments"" WHERE ""EmployeeId"" = @EmployeeId ORDER BY ""DocumentType""",
                new { EmployeeId = employeeId });
            return rows.ToList();
        }

        public async Task<EmployeeDocument?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<EmployeeDocument>(
                "SELECT * FROM \"EmployeeDocuments\" WHERE \"Id\" = @Id", new { Id = id });
        }

        public async Task<int> CreateAsync(EmployeeDocument document)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""EmployeeDocuments"" (""EmployeeId"", ""DocumentType"", ""DocumentName"", ""DocumentUrl"", ""IsVerified"", ""CreatedDate"")
                  VALUES (@EmployeeId, @DocumentType, @DocumentName, @DocumentUrl, @IsVerified, @CreatedDate)
                  RETURNING ""Id""", document);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                "DELETE FROM \"EmployeeDocuments\" WHERE \"Id\" = @Id", new { Id = id });
            return rows > 0;
        }

        public async Task<EmployeeDocument?> GetByEmployeeAndTypeAsync(int employeeId, string documentType)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<EmployeeDocument>(
                @"SELECT * FROM ""EmployeeDocuments"" WHERE ""EmployeeId"" = @EmployeeId AND ""DocumentType"" = @DocumentType",
                new { EmployeeId = employeeId, DocumentType = documentType });
        }

        public async Task<bool> DeleteByEmployeeAndTypeAsync(int employeeId, string documentType)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.ExecuteAsync(
                @"DELETE FROM ""EmployeeDocuments"" WHERE ""EmployeeId"" = @EmployeeId AND ""DocumentType"" = @DocumentType",
                new { EmployeeId = employeeId, DocumentType = documentType });
            return rows > 0;
        }
    }
}
