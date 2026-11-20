using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Tests.Infrastructure;
using Xunit;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public sealed class EmployeePayslipRepositoryTests
{
    private readonly DatabaseFixture _fixture;

    public EmployeePayslipRepositoryTests(DatabaseFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task EmployeeQueries_ReturnOnlyOwnPublishedLatestVersions()
    {
        await _fixture.ResetAsync();

        var octoberRun = await _fixture.ScalarAsync<long>(
            @"INSERT INTO payroll_runs (month, year, status, published_at)
              VALUES (10, 2026, 'PUBLISHED', NOW()) RETURNING id");
        var novemberRun = await _fixture.ScalarAsync<long>(
            @"INSERT INTO payroll_runs (month, year, status, published_at)
              VALUES (11, 2026, 'PUBLISHED', NOW()) RETURNING id");
        var draftRun = await _fixture.ScalarAsync<long>(
            @"INSERT INTO payroll_runs (month, year, status)
              VALUES (9, 2026, 'DRAFT') RETURNING id");

        var octoberV1 = await InsertPayslipAsync(octoberRun, 101, 1, "PUBLISHED");
        var octoberV2 = await InsertPayslipAsync(octoberRun, 101, 2, "PUBLISHED");
        var novemberV1 = await InsertPayslipAsync(novemberRun, 101, 1, "PUBLISHED");
        await InsertPayslipAsync(draftRun, 101, 1, "PUBLISHED");
        var otherEmployee = await InsertPayslipAsync(novemberRun, 102, 1, "PUBLISHED");

        var repository = new PayrollRepository(_fixture.DataSource);

        var all = await repository.GetEmployeePayslipsAsync(101, null);
        Assert.Equal(new[] { novemberV1, octoberV2 }, all.Select(p => p.Id));

        var october = await repository.GetEmployeePayslipsAsync(101, 2026);
        Assert.Contains(october, p => p.Id == octoberV2);
        Assert.DoesNotContain(october, p => p.Id == octoberV1);

        var latest = await repository.GetLatestEmployeePayslipAsync(101);
        Assert.NotNull(latest);
        Assert.Equal(novemberV1, latest!.Id);

        var ownOld = await repository.GetEmployeePayslipAsync(octoberV1, 101);
        Assert.NotNull(ownOld);

        var notOwned = await repository.GetEmployeePayslipAsync(otherEmployee, 101);
        Assert.Null(notOwned);
    }

    private Task<long> InsertPayslipAsync(
        long runId,
        int employeeId,
        int version,
        string status) =>
        _fixture.ScalarAsync<long>(
            @"INSERT INTO payslips
                  (run_id, employee_id, version, gross, lop_days, lop_amount,
                   adjustments, total_deductions, net_pay, items, warnings, status)
              VALUES
                  (@RunId, @EmployeeId, @Version, 38000, 2, 2533.33,
                   0, 5500, 29966.67, '[]'::jsonb, '[]'::jsonb, @Status)
              RETURNING id",
            new { RunId = runId, EmployeeId = employeeId, Version = version, Status = status });
}
