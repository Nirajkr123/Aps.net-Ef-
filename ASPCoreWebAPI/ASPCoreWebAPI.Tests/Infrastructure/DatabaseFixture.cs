using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Tests.Infrastructure;

public sealed class DatabaseFixture : IAsyncLifetime
{
    private const string SeedSql = """
        TRUNCATE TABLE
            attendance_config,
            attendance_regularization,
            attendance,
            duty_plan_audit,
            duty_plan_segment,
            duty_plan,
            "shift_assignment",
            "assignment_batch",
            "shift",
            "WorkLocations",
            "Employees",
            "Users",
            "test_fail_emp"
        RESTART IDENTITY CASCADE;

        INSERT INTO attendance_config
            (effective_from, standard_hours, max_hours_per_day, min_gap_same_day_minutes,
             min_rest_normal_minutes, rest_after_extended_minutes, max_extended_per_week,
             punch_early_minutes, punch_late_minutes, late_grace_minutes,
             unpaid_break_minutes, overtime_multiplier)
        VALUES
            (DATE '2000-01-01', 10, 20, 240, 480, 480, 3, 60, 120, 15, 0, 1.50)
        ON CONFLICT (effective_from) DO UPDATE SET
            standard_hours = EXCLUDED.standard_hours,
            max_hours_per_day = EXCLUDED.max_hours_per_day,
            min_gap_same_day_minutes = EXCLUDED.min_gap_same_day_minutes,
            min_rest_normal_minutes = EXCLUDED.min_rest_normal_minutes,
            rest_after_extended_minutes = EXCLUDED.rest_after_extended_minutes,
            max_extended_per_week = EXCLUDED.max_extended_per_week,
            punch_early_minutes = EXCLUDED.punch_early_minutes,
            punch_late_minutes = EXCLUDED.punch_late_minutes,
            late_grace_minutes = EXCLUDED.late_grace_minutes,
            unpaid_break_minutes = EXCLUDED.unpaid_break_minutes,
            overtime_multiplier = EXCLUDED.overtime_multiplier,
            updated_by = NULL;

        INSERT INTO "Users" ("Id", "FirstName", "LastName", "Email", "Role", "Status")
        VALUES
            (1, 'Owner',    'User',  'owner@shift-tests.local',    'OWNER',    'Active'),
            (2, 'HR',       'User',  'hr@shift-tests.local',       'HR',       'Active'),
            (3, 'Amit',     'Verma', 'amit@shift-tests.local',     'EMPLOYEE', 'Active');

        INSERT INTO "Employees" ("Id", "UserId", "EmployeeCode", "Status", "DepartmentName", "DesignationTitle")
        VALUES
            (101, 3,    'EMP-101', 'Active', 'Operations', 'Operator'),
            (102, NULL, 'EMP-102', 'Active', 'Operations', 'Operator'),
            (103, NULL, 'EMP-103', 'Active', 'Operations', 'Operator');

        INSERT INTO "shift"
            ("shift_id", "shift_name", "start_time", "duration_hours", "end_time", "crosses_midnight", "is_active")
        VALUES
            (1, 'Shift A', TIME '06:00', 10, TIME '16:00', FALSE, TRUE),
            (2, 'Shift B', TIME '12:00', 10, TIME '22:00', FALSE, TRUE),
            (3, 'Shift C', TIME '20:00', 10, TIME '06:00', TRUE,  TRUE);

        SELECT setval(pg_get_serial_sequence('"Users"', 'Id'),
                      COALESCE((SELECT MAX("Id") FROM "Users"), 1), TRUE);
        SELECT setval(pg_get_serial_sequence('"Employees"', 'Id'),
                      COALESCE((SELECT MAX("Id") FROM "Employees"), 1), TRUE);
        SELECT setval(pg_get_serial_sequence('"shift"', 'shift_id'),
                      COALESCE((SELECT MAX(shift_id) FROM "shift"), 1), TRUE);
        """;

    public string ConnectionString => TestDatabase.ConnectionString;

    public NpgsqlDataSource DataSource { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await TestDatabase.EnsureCreatedAsync();
        DataSource = NpgsqlDataSource.Create(ConnectionString);
    }

    public async Task DisposeAsync()
    {
        await DataSource.DisposeAsync();
    }

    public async Task ResetAsync()
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await connection.ExecuteAsync(SeedSql);
    }

    public async Task ExecuteAsync(string sql, object? parameters = null)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await connection.ExecuteAsync(sql, parameters);
    }

    public async Task<T?> ScalarAsync<T>(string sql, object? parameters = null)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        return await connection.ExecuteScalarAsync<T>(sql, parameters);
    }
}

[CollectionDefinition(Name)]
public sealed class DatabaseCollection : ICollectionFixture<DatabaseFixture>
{
    public const string Name = "shift-database";
}
