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

    [Fact]
    public async Task GetEffectiveAsync_ReturnsEnforcementPolicyDefaults()
    {
        await _database.ResetAsync();

        var config = await _repository.GetEffectiveAsync(new DateTime(2026, 1, 1));

        Assert.Equal(30, config.PunchEarlyMinutes);
        Assert.Equal(10, config.LateGraceMinutes);
        Assert.Equal(120, config.PunchLateMinutes);
        Assert.Equal(240, config.CheckoutBufferMinutes);
        Assert.Equal(4m, config.HalfDayMinHours);
        Assert.Equal(8m, config.FullDayMinHours);
        Assert.Equal("Asia/Kolkata", config.TimezoneId);
        Assert.Equal("WARN", config.EnforcementMode);
        Assert.True(config.MissedCheckoutCountsAsPresent);
    }

    [Fact]
    public async Task CreateVersionAsync_PersistsEnforcementPolicyFields()
    {
        await _database.ResetAsync();

        var created = await _repository.CreateVersionAsync(
            new AttendanceConfigUpdateRequest
            {
                EffectiveFrom = new DateTime(2026, 6, 1),
                CheckoutBufferMinutes = 300,
                HalfDayMinHours = 4.5m,
                FullDayMinHours = 9m,
                TimezoneId = "Asia/Kolkata",
                EnforcementMode = "ENFORCE",
                MissedCheckoutCountsAsPresent = false
            },
            updatedBy: 1);

        Assert.Equal(300, created.CheckoutBufferMinutes);
        Assert.Equal(4.5m, created.HalfDayMinHours);
        Assert.Equal(9m, created.FullDayMinHours);
        Assert.Equal("Asia/Kolkata", created.TimezoneId);
        Assert.Equal("ENFORCE", created.EnforcementMode);
        Assert.False(created.MissedCheckoutCountsAsPresent);
    }

    [Fact]
    public async Task CreateVersionAsync_InheritsUnspecifiedEnforcementFields()
    {
        await _database.ResetAsync();

        var created = await _repository.CreateVersionAsync(
            new AttendanceConfigUpdateRequest
            {
                EffectiveFrom = new DateTime(2026, 6, 1),
                StandardHours = 11
            },
            updatedBy: 1);

        Assert.Equal(30, created.PunchEarlyMinutes);
        Assert.Equal(10, created.LateGraceMinutes);
        Assert.Equal(240, created.CheckoutBufferMinutes);
        Assert.Equal("Asia/Kolkata", created.TimezoneId);
        Assert.Equal("WARN", created.EnforcementMode);
    }

    private Task<long> CountConfigsAsync() =>
        _database.ScalarAsync<long>("SELECT COUNT(*) FROM attendance_config;");
}
