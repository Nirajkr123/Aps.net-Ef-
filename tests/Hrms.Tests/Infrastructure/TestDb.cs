using System.Reflection;
using Npgsql;

namespace Hrms.Tests.Infrastructure;

internal static class TestDb
{
    private static readonly string DefaultConnection =
        "Host=localhost;Port=5432;Database=DapperDemoDb_Test;Username=postgres;Password=12345";

    private static readonly object Gate = new();
    private static bool _schemaReady;

    public static string ConnectionString { get; } =
        Environment.GetEnvironmentVariable("HRMS_TEST_DB_CONNECTION") is { Length: > 0 } value
            ? value
            : DefaultConnection;

    private static string TestsRoot
    {
        get
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "seed.sql")))
            {
                dir = dir.Parent;
            }

            return dir?.FullName
                ?? throw new InvalidOperationException("tests/seed.sql not found.");
        }
    }

    public static async Task EnsureSchemaAsync()
    {
        if (_schemaReady) return;

        lock (Gate)
        {
            if (_schemaReady) return;
        }

        EnsureSafeDatabase();
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(await File.ReadAllTextAsync(Path.Combine(TestsRoot, "schema_patch.sql")), connection);
        await command.ExecuteNonQueryAsync();

        lock (Gate) { _schemaReady = true; }
    }

    public static async Task SeedAsync()
    {
        await EnsureSchemaAsync();
        EnsureSafeDatabase();

        var seed = await File.ReadAllTextAsync(Path.Combine(TestsRoot, "seed.sql"));
        seed = seed.Replace("__PASSWORD_HASH__", BCrypt.Net.BCrypt.HashPassword("Test@1234"));

        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(seed, connection);
        await command.ExecuteNonQueryAsync();
    }

    public static async Task<long> ScalarAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        var result = await command.ExecuteScalarAsync();
        return Convert.ToInt64(result);
    }

    public static async Task<object?> ValueAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return await command.ExecuteScalarAsync();
    }

    public static async Task ExecuteAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private static void EnsureSafeDatabase()
    {
        var builder = new NpgsqlConnectionStringBuilder(ConnectionString);
        var database = builder.Database ?? "";
        if (database.Equals("DapperDemoDb", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Refusing to run module tests against the live DapperDemoDb.");
        if (!database.Contains("test", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Test DB name must contain 'test'.");
    }
}
