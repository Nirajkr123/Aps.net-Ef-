namespace ASPCoreWebAPI.Models
{
    public static class PayrollRunStatuses
    {
        public const string Draft = "DRAFT";
        public const string Approved = "APPROVED";
        public const string Published = "PUBLISHED";

        public static readonly string[] All = { Draft, Approved, Published };
    }

    public static class PayslipStatuses
    {
        public const string Draft = "DRAFT";
        public const string Published = "PUBLISHED";

        public static readonly string[] All = { Draft, Published };
    }

    public static class DeductionTypes
    {
        public const string Fixed = "FIXED";
        public const string PercentOfBasic = "PERCENT_OF_BASIC";
        public const string PercentOfGross = "PERCENT_OF_GROSS";

        public static readonly string[] All = { Fixed, PercentOfBasic, PercentOfGross };
    }

    public static class AdjustmentTypes
    {
        public const string Bonus = "BONUS";
        public const string Advance = "ADVANCE";
        public const string Arrears = "ARREARS";
        public const string Other = "OTHER";

        public static readonly string[] All = { Bonus, Advance, Arrears, Other };
    }

    public static class PayrollJobTypes
    {
        public const string CalculateRun = "CALCULATE_RUN";
        public const string GeneratePdf = "GENERATE_PDF";
    }

    public static class PayrollJobStatuses
    {
        public const string Queued = "QUEUED";
        public const string Running = "RUNNING";
        public const string Succeeded = "SUCCEEDED";
        public const string Failed = "FAILED";
        public const string Retrying = "RETRYING";
    }

    public class PayrollRunDto
    {
        public long Id { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public string Status { get; set; } = PayrollRunStatuses.Draft;
        public int? CreatedBy { get; set; }
        public int? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? PublishedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public int EmployeeCount { get; set; }
        public decimal TotalGross { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal NetPayout { get; set; }
        public int WarningsCount { get; set; }
    }

    public class PayslipLineItemDto
    {
        public string Name { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    public class PayslipDto
    {
        public long Id { get; set; }
        public long RunId { get; set; }
        public int EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public string? DesignationTitle { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public int Version { get; set; }
        public decimal Gross { get; set; }
        public decimal LopDays { get; set; }
        public decimal LopAmount { get; set; }
        public decimal Adjustments { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal NetPay { get; set; }
        public List<PayslipLineItemDto> Items { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public string Status { get; set; } = PayslipStatuses.Draft;
        public DateTime CreatedAt { get; set; }
    }

    public class PayslipSummaryDto
    {
        public long Id { get; set; }
        public long RunId { get; set; }
        public int EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public int Version { get; set; }
        public decimal Gross { get; set; }
        public decimal LopDays { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal NetPay { get; set; }
        public string Status { get; set; } = PayslipStatuses.Draft;
        public int WarningsCount { get; set; }
    }

    public class PayslipDownloadDto
    {
        public string FullPath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
    }

    public class SalaryStructureDto
    {
        public long Id { get; set; }
        public int EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public decimal Basic { get; set; }
        public decimal Hra { get; set; }
        public decimal Allowances { get; set; }
        public DateTime EffectiveFrom { get; set; }
        public int? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class DeductionRuleDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = DeductionTypes.Fixed;
        public decimal Value { get; set; }
        public bool IsActive { get; set; }
    }

    public class PayrollHolidayDto
    {
        public long Id { get; set; }
        public DateTime Date { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class PayrollJobDto
    {
        public long Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public long? RunId { get; set; }
        public long? PayslipId { get; set; }
        public string Status { get; set; } = string.Empty;
        public int Attempts { get; set; }
        public string? Error { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class CreatePayrollRunRequest
    {
        public int Month { get; set; }
        public int Year { get; set; }
    }

    public class CreateSalaryStructureRequest
    {
        public int EmployeeId { get; set; }
        public decimal Basic { get; set; }
        public decimal Hra { get; set; }
        public decimal Allowances { get; set; }
        public DateTime EffectiveFrom { get; set; }
    }

    public class CreateDeductionRuleRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = DeductionTypes.Fixed;
        public decimal Value { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class UpdateDeductionRuleRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = DeductionTypes.Fixed;
        public decimal Value { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class AddPayslipAdjustmentRequest
    {
        public string Type { get; set; } = AdjustmentTypes.Other;
        public decimal Amount { get; set; }
        public string? Note { get; set; }
    }

    public class ReissuePayslipRequest
    {
        public string Reason { get; set; } = string.Empty;
    }

    public class SetWeekOffRequest
    {
        public int[] Days { get; set; } = Array.Empty<int>();
    }

    public class CreateHolidayRequest
    {
        public DateTime Date { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class PayrollRunPayslipsQuery
    {
        public string? Search { get; set; }
        public string? Status { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class PayslipListResponse
    {
        public List<PayslipSummaryDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class AddAdjustmentResult
    {
        public long AdjustmentId { get; set; }
        public long PayslipId { get; set; }
        public long RunId { get; set; }
        public long? JobId { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
