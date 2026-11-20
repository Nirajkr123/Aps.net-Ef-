using System.Net;
using System.Text.Json;
using ASPCoreWebAPI.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ASPCoreWebAPI.Tests.Integration;

[Collection(DatabaseCollection.Name)]
public sealed class EmployeePayslipApiTests : IAsyncLifetime
{
    private readonly DatabaseFixture _database;
    private readonly ShiftApiFactory _factory;

    public EmployeePayslipApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new ShiftApiFactory(database);
    }

    public Task InitializeAsync() => _database.ResetAsync();

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task GetMyPayslips_ReturnsOnlyCurrentEmployeesLatestPublishedVersions()
    {
        var (octoberV2, octoberV1, latest, otherEmployee) = await SeedPayslipsAsync();
        using var client = _factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await client.GetAsync("/api/payslip/my?year=2026");
        response.EnsureSuccessStatusCode();

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var ids = json.RootElement
            .EnumerateArray()
            .Select(item => item.GetProperty("id").GetInt64())
            .ToArray();

        Assert.Equal([latest, octoberV2], ids);
        Assert.DoesNotContain(octoberV1, ids);
        Assert.DoesNotContain(otherEmployee, ids);

        var aliasResponse = await client.GetAsync("/api/me/payslips?year=2026");
        aliasResponse.EnsureSuccessStatusCode();

        using var aliasJson = JsonDocument.Parse(await aliasResponse.Content.ReadAsStringAsync());
        Assert.Equal(
            ids,
            aliasJson.RootElement
                .EnumerateArray()
                .Select(item => item.GetProperty("id").GetInt64())
                .ToArray());
    }

    [Fact]
    public async Task GetPayslip_ForAnotherEmployee_ReturnsNotFound()
    {
        var (_, _, _, otherEmployee) = await SeedPayslipsAsync();
        using var client = _factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var response = await client.GetAsync($"/api/payslip/{otherEmployee}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DownloadPayslip_ForOwnedPublishedPayslip_ReturnsPrivatePdf()
    {
        var (_, _, latest, otherEmployee) = await SeedPayslipsAsync();
        using var client = _factory.CreateAuthenticatedClient("EMPLOYEE", 3, 101);

        var environment = _factory.Services.GetRequiredService<IWebHostEnvironment>();
        var relativePath = "private/payslips/api-test-payslip.pdf";
        var fullPath = Path.Combine(
            environment.ContentRootPath,
            relativePath.Replace('/', Path.DirectorySeparatorChar));

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllTextAsync(fullPath, "%PDF-1.4 test");

        try
        {
            await _database.ExecuteAsync(
                "UPDATE payslips SET pdf_path = @PdfPath WHERE id = @Id",
                new { PdfPath = relativePath, Id = latest });

            var response = await client.GetAsync($"/api/payslip/download/{latest}");

            response.EnsureSuccessStatusCode();
            Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
            Assert.Equal(
                "%PDF-1.4 test",
                await response.Content.ReadAsStringAsync());

            var forbidden = await client.GetAsync($"/api/payslip/download/{otherEmployee}");
            Assert.Equal(HttpStatusCode.NotFound, forbidden.StatusCode);
        }
        finally
        {
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }
    }

    private async Task<(long OctoberV2, long OctoberV1, long Latest, long OtherEmployee)>
        SeedPayslipsAsync()
    {
        var octoberRun = await _database.ScalarAsync<long>(
            @"INSERT INTO payroll_runs (month, year, status, published_at)
              VALUES (10, 2026, 'PUBLISHED', NOW()) RETURNING id");
        var novemberRun = await _database.ScalarAsync<long>(
            @"INSERT INTO payroll_runs (month, year, status, published_at)
              VALUES (11, 2026, 'PUBLISHED', NOW()) RETURNING id");
        var draftRun = await _database.ScalarAsync<long>(
            @"INSERT INTO payroll_runs (month, year, status)
              VALUES (9, 2026, 'DRAFT') RETURNING id");

        var octoberV1 = await InsertPayslipAsync(octoberRun, 101, 1, "PUBLISHED");
        var octoberV2 = await InsertPayslipAsync(octoberRun, 101, 2, "PUBLISHED");
        var latest = await InsertPayslipAsync(novemberRun, 101, 1, "PUBLISHED");
        await InsertPayslipAsync(draftRun, 101, 1, "PUBLISHED");
        var otherEmployee = await InsertPayslipAsync(novemberRun, 102, 1, "PUBLISHED");

        return (octoberV2, octoberV1, latest, otherEmployee);
    }

    private Task<long> InsertPayslipAsync(
        long runId,
        int employeeId,
        int version,
        string status) =>
        _database.ScalarAsync<long>(
            @"INSERT INTO payslips
                  (run_id, employee_id, version, gross, lop_days, lop_amount,
                   adjustments, total_deductions, net_pay, items, warnings, status)
              VALUES
                  (@RunId, @EmployeeId, @Version, 38000, 2, 2533.33,
                   0, 5500, 29966.67, '[]'::jsonb, '[]'::jsonb, @Status)
              RETURNING id",
            new { RunId = runId, EmployeeId = employeeId, Version = version, Status = status });
}
