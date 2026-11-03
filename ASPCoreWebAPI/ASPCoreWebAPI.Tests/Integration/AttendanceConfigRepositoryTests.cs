using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Tests.Infrastructure;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public class AttendanceConfigRepositoryTests
{
    private readonly DatabaseFixture _database;
    private readonly AttendanceConfigRepository _repository;

    public AttendanceConfigRepositoryTests(DatabaseFixture database)
    {
        _database = database;
        _repository = new AttendanceConfigRepository(database.DataSource);
    }

    [Fact]
    public async Task GetEffectiveAsync_UsesLatestVersionAtOrBeforeDate()
    {
        await _database.ResetAsync();
        await _database.ExecuteAsync(
            """
            INSERT INTO attendance_config
                (effective_from, standard_hours, max_hours_per_day, min_gap_same_day_minutes,
                 min_rest_normal_minutes, rest_after_extended_minutes, max_extended_per_week,
                 punch_early_minutes, punch_late_minutes, late_grace_minutes,
                 unpaid_break_minutes, overtime_multiplier)
            VALUES
                (DATE '2026-01-01', 10.5, 20, 240, 600, 600, 3, 60, 120, 15, 0, 1.50);
            """);

        var before = await _repository.GetEffectiveAsync(new DateTime(2025, 12, 31));
        var exactly = await _repository.GetEffectiveAsync(new DateTime(2026, 1, 1));
        var after = await _repository.GetEffectiveAsync(new DateTime(2027, 1, 1));

        Assert.Equal(480, before.MinRestNormalMinutes);
        Assert.Equal(600, exactly.MinRestNormalMinutes);
        Assert.Equal(10.5m, exactly.StandardHours);
        Assert.Equal(600, after.MinRestNormalMinutes);
    }

    [Fact]
    public async Task CreateVersionAsync_InsertsAndUpdatesSameEffectiveDate()
    {
        await _database.ResetAsync();

        var created = await _repository.CreateVersionAsync(
            new AttendanceConfigUpdateRequest
            {
                EffectiveFrom = new DateTime(2026, 6, 1),
                StandardHours = 11,
                MinRestNormalMinutes = 540
            },
            updatedBy: 1);

        Assert.Equal(new DateTime(2026, 6, 1), created.EffectiveFrom);
        Assert.Equal(11m, created.StandardHours);
        Assert.Equal(540, created.MinRestNormalMinutes);
        Assert.Equal(2, await CountConfigsAsync());

        var updated = await _repository.CreateVersionAsync(
            new AttendanceConfigUpdateRequest
            {
                EffectiveFrom = new DateTime(2026, 6, 1),
                StandardHours = 12
            },
            updatedBy: 1);

        Assert.Equal(created.Id, updated.Id);
        Assert.Equal(12m, updated.StandardHours);
        Assert.Equal(540, updated.MinRestNormalMinutes);
        Assert.Equal(2, await CountConfigsAsync());
    }

    private Task<long> CountConfigsAsync() =>
        _database.ScalarAsync<long>("SELECT COUNT(*) FROM attendance_config;");
}
