using System.Globalization;
using System.Text.Json;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using PdfSharp.Drawing;
using PdfSharp.Pdf;

namespace ASPCoreWebAPI.Services
{
    public interface IPayslipPdfService
    {
        Task<string> GeneratePayslipAsync(
            long payslipId,
            CancellationToken cancellationToken = default);

        string GetAbsolutePath(string relativePath);
    }

    public class PayslipPdfService : IPayslipPdfService
    {
        private const double Margin = 42;
        private const double ColumnGap = 24;

        private readonly IPayrollRepository _repository;
        private readonly IWebHostEnvironment _environment;

        public PayslipPdfService(
            IPayrollRepository repository,
            IWebHostEnvironment environment)
        {
            _repository = repository;
            _environment = environment;
        }

        public async Task<string> GeneratePayslipAsync(
            long payslipId,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var payslip = await _repository.GetPayslipAsync(payslipId);
            if (payslip is null)
            {
                throw new PayrollNotFoundException("Payslip not found.");
            }

            var relativePath = BuildRelativePath(payslip);
            var fullPath = GetAbsolutePath(relativePath);

            var directory = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var tempPath = fullPath + "." + Guid.NewGuid().ToString("N") + ".tmp";

            try
            {
                using var document = BuildDocument(payslip);
                document.Save(tempPath);
                File.Move(tempPath, fullPath, true);
            }
            finally
            {
                if (File.Exists(tempPath))
                {
                    File.Delete(tempPath);
                }
            }

            await _repository.UpdatePayslipPdfPathAsync(payslipId, relativePath);
            return relativePath;
        }

        public string GetAbsolutePath(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
            {
                throw new ArgumentException("Payslip path is required.", nameof(relativePath));
            }

            var root = Path.GetFullPath(Path.Combine(
                _environment.ContentRootPath,
                "private",
                "payslips"));
            var fullPath = Path.GetFullPath(Path.Combine(
                _environment.ContentRootPath,
                relativePath.Replace('/', Path.DirectorySeparatorChar)));
            var rootPrefix = root.TrimEnd(Path.DirectorySeparatorChar) +
                Path.DirectorySeparatorChar;

            if (!fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Payslip path is outside private storage.");
            }

            return fullPath;
        }

        private static PdfDocument BuildDocument(Payslip payslip)
        {
            var items = Deserialize<List<PayslipLineItemDto>>(payslip.Items);
            var warnings = Deserialize<List<string>>(payslip.Warnings);

            var earnings = items.Where(item => item.Amount >= 0m).ToList();
            var deductions = items
                .Where(item => item.Amount < 0m)
                .Select(item => new PayslipLineItemDto
                {
                    Name = item.Name,
                    Amount = Math.Abs(item.Amount)
                })
                .ToList();

            var document = new PdfDocument();
            document.Info.Title =
                $"Payslip {payslip.EmployeeCode} {payslip.Month:00}/{payslip.Year}";
            document.Info.Author = "HRMS";

            var page = document.AddPage();
            using var gfx = XGraphics.FromPdfPage(page);

            var titleFont = new XFont("Arial", 20, XFontStyleEx.Bold);
            var sectionFont = new XFont("Arial", 11, XFontStyleEx.Bold);
            var labelFont = new XFont("Arial", 9, XFontStyleEx.Bold);
            var bodyFont = new XFont("Arial", 9, XFontStyleEx.Regular);
            var footerFont = new XFont("Arial", 7.5, XFontStyleEx.Regular);
            var linePen = new XPen(XColors.Gray, 0.75);

            var pageWidth = page.Width.Point;
            var contentWidth = pageWidth - (Margin * 2);
            var y = Margin;

            gfx.DrawString(
                "PAYSLIP",
                titleFont,
                XBrushes.Black,
                new XRect(0, y, pageWidth, 28),
                XStringFormats.TopCenter);

            y += 34;
            gfx.DrawLine(linePen, Margin, y, pageWidth - Margin, y);
            y += 14;

            var period = new DateTime(payslip.Year, payslip.Month, 1)
                .ToString("MMMM yyyy", CultureInfo.InvariantCulture);

            var leftX = Margin;
            var rightX = Margin + (contentWidth / 2) + (ColumnGap / 2);
            var fieldWidth = (contentWidth / 2) - ColumnGap;

            DrawField(gfx, "Employee", payslip.EmployeeName ?? "-", leftX, y, fieldWidth, labelFont, bodyFont);
            DrawField(gfx, "Employee Code", payslip.EmployeeCode ?? "-", rightX, y, fieldWidth, labelFont, bodyFont);
            y += 20;
            DrawField(gfx, "Designation", payslip.DesignationTitle ?? "-", leftX, y, fieldWidth, labelFont, bodyFont);
            DrawField(gfx, "Pay Period", period, rightX, y, fieldWidth, labelFont, bodyFont);
            y += 20;
            DrawField(gfx, "Version", payslip.Version.ToString(CultureInfo.InvariantCulture), leftX, y, fieldWidth, labelFont, bodyFont);
            DrawField(gfx, "Status", payslip.Status, rightX, y, fieldWidth, labelFont, bodyFont);

            y += 30;
            gfx.DrawString("Earnings", sectionFont, XBrushes.Black, leftX, y);
            gfx.DrawString("Deductions", sectionFont, XBrushes.Black, rightX, y);
            y += 18;

            var earningsY = y;
            var deductionsY = y;

            if (earnings.Count == 0)
            {
                gfx.DrawString("No earnings available.", bodyFont, XBrushes.Gray, leftX + 8, earningsY);
                earningsY += 16;
            }
            else
            {
                foreach (var item in earnings)
                {
                    DrawAmountRow(gfx, item.Name, item.Amount, leftX, fieldWidth, earningsY, bodyFont);
                    earningsY += 16;
                }
            }

            if (deductions.Count == 0)
            {
                gfx.DrawString("No deductions.", bodyFont, XBrushes.Gray, rightX + 8, deductionsY);
                deductionsY += 16;
            }
            else
            {
                foreach (var item in deductions)
                {
                    DrawAmountRow(gfx, item.Name, item.Amount, rightX, fieldWidth, deductionsY, bodyFont);
                    deductionsY += 16;
                }
            }

            y = Math.Max(earningsY, deductionsY) + 12;
            gfx.DrawLine(linePen, Margin, y, pageWidth - Margin, y);
            y += 14;

            DrawAmountRow(gfx, "Gross Earnings", payslip.Gross, leftX, contentWidth, y, sectionFont);
            y += 20;
            DrawAmountRow(gfx, "LOP Deduction", payslip.LopAmount, leftX, contentWidth, y, bodyFont);
            y += 16;
            DrawAmountRow(gfx, "Total Deductions", payslip.TotalDeductions, leftX, contentWidth, y, bodyFont);
            y += 16;
            DrawAmountRow(gfx, "Adjustments", payslip.Adjustments, leftX, contentWidth, y, bodyFont);
            y += 22;

            gfx.DrawLine(linePen, Margin, y, pageWidth - Margin, y);
            y += 14;
            DrawAmountRow(gfx, "Net Pay", payslip.NetPay, leftX, contentWidth, y, sectionFont);

            if (warnings.Count > 0)
            {
                y += 30;
                gfx.DrawString("Notes", sectionFont, XBrushes.Black, leftX, y);
                y += 16;

                foreach (var warning in warnings)
                {
                    gfx.DrawString("- " + warning, bodyFont, XBrushes.Gray, leftX + 8, y);
                    y += 14;
                }
            }

            var footerY = page.Height.Point - 54;
            gfx.DrawLine(linePen, Margin, footerY, pageWidth - Margin, footerY);
            gfx.DrawString(
                "This is a computer-generated payslip. PF / ESI / Professional Tax / TDS rules must be verified by a payroll expert or CA.",
                footerFont,
                XBrushes.Gray,
                new XRect(Margin, footerY + 8, contentWidth, 20),
                XStringFormats.TopLeft);
            gfx.DrawString(
                "Generated " + DateTime.UtcNow.ToString("dd MMM yyyy HH:mm", CultureInfo.InvariantCulture) + " UTC",
                footerFont,
                XBrushes.Gray,
                new XRect(Margin, footerY + 20, contentWidth, 20),
                XStringFormats.TopLeft);

            return document;
        }

        private static void DrawField(
            XGraphics gfx,
            string label,
            string value,
            double x,
            double y,
            double width,
            XFont labelFont,
            XFont valueFont)
        {
            gfx.DrawString(label.ToUpperInvariant(), labelFont, XBrushes.Gray, x, y);
            gfx.DrawString(value, valueFont, XBrushes.Black, x, y + 11);
        }

        private static void DrawAmountRow(
            XGraphics gfx,
            string label,
            decimal amount,
            double x,
            double width,
            double y,
            XFont font)
        {
            gfx.DrawString(label, font, XBrushes.Black, x + 8, y);
            gfx.DrawString(
                FormatAmount(amount),
                font,
                XBrushes.Black,
                new XRect(x, y, width - 8, 14),
                XStringFormats.TopRight);
        }

        private static string FormatAmount(decimal amount) =>
            amount.ToString("#,##0.00", CultureInfo.InvariantCulture);

        private static string BuildRelativePath(Payslip payslip) =>
            $"private/payslips/{payslip.Year}-{payslip.Month:00}/" +
            $"payslip-{payslip.Id}-v{payslip.Version}.pdf";

        private static T Deserialize<T>(string? json) where T : new()
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new T();
            }

            try
            {
                return JsonSerializer.Deserialize<T>(json) ?? new T();
            }
            catch (JsonException)
            {
                return new T();
            }
        }
    }
}
