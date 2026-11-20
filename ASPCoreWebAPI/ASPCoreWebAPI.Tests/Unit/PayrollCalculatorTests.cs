using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Services;

namespace ASPCoreWebAPI.Tests.Unit;

public class PayrollCalculatorTests
{
    [Fact]
    public void Calculate_ProducesExpectedSamplePayslip()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            2m,
            new[] { FixedProvidentFund() },
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(30, result.DaysInMonth);
        Assert.Equal(38000m, result.Gross);
        Assert.Equal(2533.33m, result.LopAmount);
        Assert.Equal(5500m, result.TotalDeductions);
        Assert.Equal(29966.67m, result.NetPay);
        Assert.Equal(result.NetPay, result.Items.Sum(i => i.Amount));
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Calculate_SupportsPercentOfBasicDeductions()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            0m,
            new[]
            {
                new DeductionRule { Name = "Provident Fund", Type = DeductionTypes.PercentOfBasic, Value = 12m, IsActive = true }
            },
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(3000m, result.TotalDeductions);
        Assert.Equal(35000m, result.NetPay);
    }

    [Fact]
    public void Calculate_UsesCalendarDaysInMonth()
    {
        var result = PayrollCalculator.Calculate(
            Salary(basic: 20000m, hra: 8000m, allowances: 3000m),
            2026,
            5,
            1m,
            Array.Empty<DeductionRule>(),
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(31, result.DaysInMonth);
        Assert.Equal(31000m, result.Gross);
        Assert.Equal(1000m, result.LopAmount);
        Assert.Equal(30000m, result.NetPay);
    }

    [Fact]
    public void Calculate_SupportsFixedAndPercentOfGrossDeductions()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            0m,
            new[]
            {
                new DeductionRule { Name = "Professional Tax", Type = DeductionTypes.Fixed, Value = 200m, IsActive = true },
                new DeductionRule { Name = "Special", Type = DeductionTypes.PercentOfGross, Value = 5m, IsActive = true }
            },
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(2100m, result.TotalDeductions);
        Assert.Equal(35900m, result.NetPay);
        Assert.Equal(result.NetPay, result.Items.Sum(i => i.Amount));
    }

    [Fact]
    public void Calculate_AddsSignedAdjustmentsToNetPay()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            0m,
            new[] { FixedProvidentFund() },
            new[]
            {
                new PayslipAdjustment { Type = AdjustmentTypes.Bonus, Amount = 1000m },
                new PayslipAdjustment { Type = AdjustmentTypes.Advance, Amount = -500m }
            });

        Assert.Equal(500m, result.Adjustments);
        Assert.Equal(33000m, result.NetPay);
        Assert.Equal(result.NetPay, result.Items.Sum(i => i.Amount));
    }

    [Fact]
    public void Calculate_IgnoresInactiveRules()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            0m,
            new[]
            {
                new DeductionRule { Name = "Inactive", Type = DeductionTypes.Fixed, Value = 500m, IsActive = false }
            },
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(0m, result.TotalDeductions);
        Assert.Equal(38000m, result.NetPay);
    }

    [Fact]
    public void Calculate_SkipsUnknownRuleTypeWithWarning()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            0m,
            new[]
            {
                new DeductionRule { Name = "Mystery", Type = "MYSTERY", Value = 100m, IsActive = true }
            },
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(0m, result.TotalDeductions);
        Assert.Contains(result.Warnings, w => w.Contains("unknown type", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Calculate_SkipsNegativeRuleValueWithWarning()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            0m,
            new[]
            {
                new DeductionRule { Name = "Broken", Type = DeductionTypes.Fixed, Value = -100m, IsActive = true }
            },
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(0m, result.TotalDeductions);
        Assert.Contains(result.Warnings, w => w.Contains("negative value", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Calculate_ClampsLopDaysToMonthLength()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            31m,
            Array.Empty<DeductionRule>(),
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(30m, result.LopDays);
        Assert.Equal(38000m, result.LopAmount);
        Assert.Equal(0m, result.NetPay);
    }

    [Fact]
    public void Calculate_WarnsWhenNetPayIsNegative()
    {
        var result = PayrollCalculator.Calculate(
            Salary(),
            2026,
            4,
            0m,
            new[]
            {
                new DeductionRule { Name = "Too Much", Type = DeductionTypes.Fixed, Value = 40000m, IsActive = true }
            },
            Array.Empty<PayslipAdjustment>());

        Assert.Equal(-2000m, result.NetPay);
        Assert.Contains(result.Warnings, w => w.Contains("negative", StringComparison.OrdinalIgnoreCase));
    }

    private static SalaryStructure Salary(
        decimal basic = 25000m,
        decimal hra = 10000m,
        decimal allowances = 3000m) =>
        new()
        {
            Basic = basic,
            Hra = hra,
            Allowances = allowances
        };

    private static DeductionRule FixedProvidentFund() =>
        new()
        {
            Name = "Provident Fund",
            Type = DeductionTypes.Fixed,
            Value = 5500m,
            IsActive = true
        };
}
