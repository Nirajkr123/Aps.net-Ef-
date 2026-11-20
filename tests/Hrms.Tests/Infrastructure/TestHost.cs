namespace Hrms.Tests.Infrastructure;

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class HrmsCollection : ICollectionFixture<TestHost>
{
    public const string Name = "hrms-suite";
}

public sealed class TestHost : IAsyncLifetime
{
    public MutableClock Clock { get; } = new();
    public ApiFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await TestDb.EnsureSchemaAsync();
        await TestDb.SeedAsync();
        Factory = new ApiFactory(Clock);
        _ = Factory.CreateClient();
    }

    public Task DisposeAsync()
    {
        Factory.Dispose();
        return Task.CompletedTask;
    }

    public Task SeedAsync()
    {
        Clock.Reset();
        return TestDb.SeedAsync();
    }

    public HttpClient Owner() => Factory.Client("OWNER", 1);
    public HttpClient Hr() => Factory.Client("HR", 2);
    public HttpClient Employee(int employeeId) =>
        Factory.Client("EMPLOYEE", employeeId switch
        {
            102 => 11,
            103 => 12,
            104 => 13,
            105 => 14,
            106 => 15,
            101 => 10,
            _ => 11,
        }, employeeId);
    public HttpClient Anonymous() => Factory.Anonymous();
}
