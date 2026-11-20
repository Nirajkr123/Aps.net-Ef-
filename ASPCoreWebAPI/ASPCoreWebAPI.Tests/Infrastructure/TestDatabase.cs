using System.Reflection;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Tests.Infrastructure;

internal static class TestDatabase
{
    private const string DefaultConnectionString =
        "Host=localhost;Port=5432;Database=DapperDemoDb_Test;Username=postgres;Password=12345";

    public static string ConnectionString { get; } = ResolveConnectionString();

    private static string ResolveConnectionString()
    {
        var value = Environment.GetEnvironmentVariable("SHIFT_TEST_DB_CONNECTION");
        return string.IsNullOrWhiteSpace(value) ? DefaultConnectionString : value;
    }

    public static async Task EnsureCreatedAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(ConnectionString);
        var database = builder.Database
            ?? throw new InvalidOperationException("Test database name is missing.");
        EnsureSafeDatabase(database);

        var adminBuilder = new NpgsqlConnectionStringBuilder(ConnectionString)
        {
            Database = "postgres"
        };

        await using (var admin = new NpgsqlConnection(adminBuilder.ConnectionString))
        {
            await admin.OpenAsync();
            var exists = await admin.ExecuteScalarAsync<bool>(
                "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = @Name)",
                new { Name = database });

            if (!exists)
            {
                var escaped = database.Replace("\"", "\"\"");
                await admin.ExecuteAsync($"CREATE DATABASE \"{escaped}\"");
            }
        }

        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await connection.ExecuteAsync(ReadSchema());
    }

    public static void EnsureSafeDatabase(string? database)
    {
        if (string.IsNullOrWhiteSpace(database))
            throw new InvalidOperationException("Test database name is missing.");

        if (database.Equals("DapperDemoDb", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Refusing to run shift tests against the live DapperDemoDb database.");

        if (!database.Contains("test", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "SHIFT_TEST_DB_CONNECTION must point to a dedicated database whose name contains 'test'.");
    }

    private static string ReadSchema()
    {
        var assembly = Assembly.GetExecutingAssembly();
        const string resourceName = "ASPCoreWebAPI.Tests.Database.TestSchema.sql";
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource '{resourceName}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
