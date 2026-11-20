using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Services
{
    public sealed class PayrollCalculationResult
    {
        public int DaysInMonth { get; init; }
        public decimal Gross { get; init; }
        public decimal LopDays { get; init; }
        public decimal LopAmount { get; init; }
        public decimal Adjustments { get; init; }
        public decimal TotalDeductions { get; init; }
        public decimal NetPay { get; init; }
        public List<PayslipLineItemDto> Items { get; init; } = new();
        public List<string> Warnings { get; init; } = new();
    }

    public static class PayrollCalculator
    {
        public static PayrollCalculationResult Calculate(
            SalaryStructure salary,
            int year,
            int month,
            decimal lopDays,
            IEnumerable<DeductionRule>? deductionRules,
            IEnumerable<PayslipAdjustment>? adjustments)
        {
            ArgumentNullException.ThrowIfNull(salary);

            var daysInMonth = DateTime.DaysInMonth(year, month);
            var basic = Money.Round(salary.Basic);
            var hra = Money.Round(salary.Hra);
            var allowances = Money.Round(salary.Allowances);
            var gross = Money.Round(basic + hra + allowances);

            var effectiveLopDays = Math.Clamp(lopDays, 0m, daysInMonth);
            var lopAmount = Money.Round(gross / daysInMonth * effectiveLopDays);

            var items = new List<PayslipLineItemDto>
            {
                new() { Name = "Basic", Amount = basic },
                new() { Name = "HRA", Amount = hra }
            };

            if (allowances != 0m)
            {
                items.Add(new PayslipLineItemDto { Name = "Allowances", Amount = allowances });
            }

            if (lopAmount != 0m)
            {
                items.Add(new PayslipLineItemDto { Name = "LOP Deduction", Amount = -lopAmount });
            }

            var warnings = new List<string>();
            var totalDeductions = 0m;

            foreach (var rule in deductionRules ?? Enumerable.Empty<DeductionRule>())
            {
                if (!rule.IsActive)
                {
                    continue;
                }

                if (rule.Value < 0m)
                {
                    warnings.Add($"Deduction rule '{rule.Name}' has a negative value; skipped.");
                    continue;
                }

                decimal amount;
                switch (rule.Type)
                {
                    case DeductionTypes.Fixed:
                        amount = Money.Round(rule.Value);
                        break;
                    case DeductionTypes.PercentOfBasic:
                        amount = Money.PercentOf(basic, rule.Value);
                        break;
                    case DeductionTypes.PercentOfGross:
                        amount = Money.PercentOf(gross, rule.Value);
                        break;
                    default:
                        warnings.Add($"Deduction rule '{rule.Name}' has unknown type '{rule.Type}'; skipped.");
                        continue;
                }

                if (amount == 0m)
                {
                    continue;
                }

                totalDeductions += amount;
                items.Add(new PayslipLineItemDto { Name = rule.Name, Amount = -amount });
            }

            totalDeductions = Money.Round(totalDeductions);

            var adjustmentTotal = 0m;

            foreach (var adjustment in adjustments ?? Enumerable.Empty<PayslipAdjustment>())
            {
                var amount = Money.Round(adjustment.Amount);

                if (amount == 0m)
                {
                    continue;
                }

                adjustmentTotal += amount;
                items.Add(new PayslipLineItemDto { Name = adjustment.Type, Amount = amount });
            }

            adjustmentTotal = Money.Round(adjustmentTotal);
            var netPay = Money.Round(gross - lopAmount - totalDeductions + adjustmentTotal);

            if (netPay < 0m)
            {
                warnings.Add("Net pay is negative; review salary structure and LOP.");
            }

            return new PayrollCalculationResult
            {
                DaysInMonth = daysInMonth,
                Gross = gross,
                LopDays = effectiveLopDays,
                LopAmount = lopAmount,
                Adjustments = adjustmentTotal,
                TotalDeductions = totalDeductions,
                NetPay = netPay,
                Items = items,
                Warnings = warnings
            };
        }
    }
}
