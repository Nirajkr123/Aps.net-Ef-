using System.Reflection;
using Dapper;
using Npgsql;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class AttendanceMigrationTests
{
    private const string LegacySchema = """
        CREATE TABLE attendance_config (
            id                             SMALLINT PRIMARY KEY DEFAULT 1,
            effective_from                 DATE NOT NULL DEFAULT DATE '2000-01-01',
            standard_hours                 NUMERIC(5,2) NOT NULL DEFAULT 10,
            max_hours_per_day              NUMERIC(5,2) NOT NULL DEFAULT 20,
            min_gap_same_day_minutes       INTEGER NOT NULL DEFAULT 240,
            min_rest_normal_minutes        INTEGER NOT NULL DEFAULT 480,
            rest_after_extended_minutes    INTEGER NOT NULL DEFAULT 480,
            max_extended_per_week          INTEGER NOT NULL DEFAULT 3,
            punch_early_minutes            INTEGER NOT NULL DEFAULT 60,
            punch_late_minutes             INTEGER NOT NULL DEFAULT 120,
            late_grace_minutes             INTEGER NOT NULL DEFAULT 15,
            unpaid_break_minutes           INTEGER NOT NULL DEFAULT 0,
            overtime_multiplier            NUMERIC(5,2) NOT NULL DEFAULT 1.50,
            updated_at                     TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_by                     INTEGER NULL
        );

        INSERT INTO attendance_config (effective_from) VALUES (DATE '2000-01-01');

        CREATE TABLE "shift" (
            shift_id         SERIAL PRIMARY KEY,
            shift_name       VARCHAR(100) NOT NULL,
            start_time       TIME NOT NULL,
            duration_hours   NUMERIC(4,2) NOT NULL DEFAULT 10,
            end_time         TIME NOT NULL,
            crosses_midnight BOOLEAN NOT NULL DEFAULT FALSE,
            is_active        BOOLEAN NOT NULL DEFAULT TRUE,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
        );

        INSERT INTO "shift" (shift_name, start_time, duration_hours, end_time)
        VALUES ('Legacy Shift', TIME '06:00', 10, TIME '16:00');

        CREATE TABLE attendance (
            id               SERIAL PRIMARY KEY,
            employee_id      INTEGER NOT NULL,
            attendance_date  DATE NOT NULL,
            check_in_time    TIMESTAMP NULL
        );

        INSERT INTO attendance (employee_id, attendance_date)
        VALUES (1, DATE '2026-01-01');

        CREATE TABLE audit_logs (
            id          BIGSERIAL PRIMARY KEY,
            user_id     INTEGER NULL,
            action      TEXT NOT NULL,
            entity      VARCHAR(50) NOT NULL,
            entity_id   BIGINT NULL,
            details     JSONB NOT NULL DEFAULT '{}'::jsonb,
            at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """;

    private readonly DatabaseFixture _database;

    public AttendanceMigrationTests(DatabaseFixture database)
    {
        _database = database;
    }

    [Fact]
    public async Task Migration_AppliesIdempotently_RollsBack_AndReapplies()
    {
        var builder = new NpgsqlConnectionStringBuilder(_database.ConnectionString);
        var databaseName = $"step1_migration_test_{Guid.NewGuid():N}";
        var adminConnectionString = new NpgsqlConnectionStringBuilder(_database.ConnectionString)
        {
            Database = "postgres"
        }.ConnectionString;
        var targetConnectionString = new NpgsqlConnectionStringBuilder(_database.ConnectionString)
        {
            Database = databaseName
        }.ConnectionString;

        var forward = ReadResource("ASPCoreWebAPI.Tests.Database.AddAttendanceEnforcement.sql");
        var rollback = ReadResource("ASPCoreWebAPI.Tests.Database.RollbackAttendanceEnforcement.sql");

        await using var admin = new NpgsqlConnection(adminConnectionString);
        await admin.OpenAsync();

        try
        {
            await admin.ExecuteAsync($"CREATE DATABASE \"{databaseName}\"");

            await using var connection = new NpgsqlConnection(targetConnectionString);
            await connection.OpenAsync();

            await connection.ExecuteAsync(LegacySchema);
            await connection.ExecuteAsync(forward);
            await connection.ExecuteAsync(forward);

            Assert.Equal(2, await ScalarAsync<int>(connection,
                "SELECT COUNT(*) FROM attendance_config;"));
            Assert.Equal(30, await ScalarAsync<int>(connection,
                "SELECT punch_early_minutes FROM attendance_config WHERE effective_from = CURRENT_DATE;"));
            Assert.Equal(240, await ScalarAsync<int>(connection,
                "SELECT checkout_buffer_minutes FROM attendance_config WHERE effective_from = CURRENT_DATE;"));
            Assert.Equal("WARN", await ScalarAsync<string>(connection,
                "SELECT enforcement_mode FROM attendance_config WHERE effective_from = CURRENT_DATE;"));
            Assert.Equal(2, await ScalarAsync<int>(connection,
                "SELECT COUNT(*) FROM audit_logs WHERE action = 'ATTENDANCE_CONFIG_VERSIONED';"));
            Assert.Equal("SELF", await ScalarAsync<string>(connection,
                "SELECT source FROM attendance WHERE id = 1;"));

            Assert.Equal(1, await ColumnCountAsync(connection, "attendance_config", "enforcement_mode"));
            Assert.Equal(1, await ColumnCountAsync(connection, "shift", "pending_rules"));
            Assert.Equal(1, await ColumnCountAsync(connection, "attendance", "source"));
            Assert.Equal(1, await ColumnCountAsync(connection, "audit_logs", "before"));

            await connection.ExecuteAsync(rollback);

            Assert.Equal(0, await ColumnCountAsync(connection, "attendance_config", "enforcement_mode"));
            Assert.Equal(0, await ColumnCountAsync(connection, "shift", "pending_rules"));
            Assert.Equal(0, await ColumnCountAsync(connection, "attendance", "source"));
            Assert.Equal(0, await ColumnCountAsync(connection, "audit_logs", "before"));
            Assert.Equal(2, await ScalarAsync<int>(connection,
                "SELECT COUNT(*) FROM attendance_config;"));
            Assert.Equal(1, await ScalarAsync<int>(connection,
                "SELECT COUNT(*) FROM attendance;"));
            Assert.Equal("Legacy Shift", await ScalarAsync<string>(connection,
                """SELECT shift_name FROM "shift" WHERE shift_id = 1;"""));

            await connection.ExecuteAsync(forward);

            Assert.Equal(1, await ColumnCountAsync(connection, "attendance_config", "enforcement_mode"));
            Assert.Equal(1, await ColumnCountAsync(connection, "shift", "pending_rules"));
            Assert.Equal(1, await ColumnCountAsync(connection, "attendance", "source"));
            Assert.Equal(1, await ColumnCountAsync(connection, "audit_logs", "before"));
        }
        finally
        {
            await admin.ExecuteAsync(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @Name AND pid <> pg_backend_pid();",
                new { Name = databaseName });
            await admin.ExecuteAsync($"DROP DATABASE IF EXISTS \"{databaseName}\";");
        }
    }

    private static Task<int> ColumnCountAsync(
        NpgsqlConnection connection,
        string table,
        string column) =>
        ScalarAsync<int>(
            connection,
            """
            SELECT COUNT(*)::int
              FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = @Table
               AND column_name = @Column;
            """,
            new { Table = table, Column = column });

    private static Task<T?> ScalarAsync<T>(
        NpgsqlConnection connection,
        string sql,
        object? parameters = null) =>
        connection.ExecuteScalarAsync<T>(sql, parameters);

    private static string ReadResource(string name)
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded resource '{name}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
