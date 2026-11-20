using ASPCoreWebAPI.Services;

namespace ASPCoreWebAPI.Tests.Unit;

public class MoneyTests
{
    [Fact]
    public void Round_UsesTwoDecimalsAndAwayFromZero()
    {
        Assert.Equal(2533.33m, Money.Round(2533.333m));
        Assert.Equal(1.01m, Money.Round(1.005m));
        Assert.Equal(-1.01m, Money.Round(-1.005m));
        Assert.Equal(0m, Money.Round(0.004m));
    }

    [Fact]
    public void PercentOf_RoundsResultToMoneyPrecision()
    {
        Assert.Equal(3000m, Money.PercentOf(25000m, 12m));
        Assert.Equal(950m, Money.PercentOf(38000m, 2.5m));
        Assert.Equal(89.51m, Money.PercentOf(1234.56m, 7.25m));
    }
}
