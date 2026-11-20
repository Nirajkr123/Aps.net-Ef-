using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;

namespace ASPCoreWebAPI.Services
{
    public class PayrollJobWorker : BackgroundService
    {
        private const int MaxAttempts = 3;
        private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(2);
        private static readonly TimeSpan ErrorDelay = TimeSpan.FromSeconds(5);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<PayrollJobWorker> _logger;

        public PayrollJobWorker(
            IServiceScopeFactory scopeFactory,
            ILogger<PayrollJobWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var repository = scope.ServiceProvider.GetRequiredService<IPayrollRepository>();
                    var job = await repository.ClaimNextJobAsync();

                    if (job is null)
                    {
                        await Task.Delay(PollInterval, stoppingToken);
                        continue;
                    }

                    await ProcessJobAsync(scope.ServiceProvider, repository, job, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception)
                {
                    _logger.LogError("Payroll worker iteration failed.");
                    await Task.Delay(ErrorDelay, stoppingToken);
                }
            }
        }

        private async Task ProcessJobAsync(
            IServiceProvider services,
            IPayrollRepository repository,
            PayrollJob job,
            CancellationToken cancellationToken)
        {
            try
            {
                switch (job.Type)
                {
                    case PayrollJobTypes.CalculateRun:
                        if (job.RunId is null)
                        {
                            await repository.MarkJobFailedAsync(
                                job.Id,
                                "Payroll run is missing.",
                                false);
                            return;
                        }

                        var payrollService = services.GetRequiredService<IPayrollService>();
                        await payrollService.ProcessRunAsync(job.RunId.Value, cancellationToken);
                        break;

                    case PayrollJobTypes.GeneratePdf:
                        if (job.PayslipId is null)
                        {
                            await repository.MarkJobFailedAsync(
                                job.Id,
                                "Payslip is missing.",
                                false);
                            return;
                        }

                        var pdfService = services.GetRequiredService<IPayslipPdfService>();
                        await pdfService.GeneratePayslipAsync(
                            job.PayslipId.Value,
                            cancellationToken);

                        await NotifyPayslipReadyAsync(
                            services,
                            repository,
                            job.PayslipId.Value);
                        break;

                    default:
                        await repository.MarkJobFailedAsync(
                            job.Id,
                            "Unsupported payroll job.",
                            false);
                        return;
                }

                await repository.MarkJobSucceededAsync(job.Id);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("Payroll job {JobId} failed.", job.Id);
                await repository.MarkJobFailedAsync(
                    job.Id,
                    "Payroll job failed.",
                    job.Attempts < MaxAttempts);
            }
        }

        private async Task NotifyPayslipReadyAsync(
            IServiceProvider services,
            IPayrollRepository repository,
            long payslipId)
        {
            try
            {
                var target = await repository.GetPayslipNotificationAsync(payslipId);

                if (target?.UserId is not int userId ||
                    userId <= 0 ||
                    !target.IsLatest ||
                    target.Status != PayslipStatuses.Published)
                {
                    return;
                }

                var period = new DateTime(target.Year, target.Month, 1)
                    .ToString("MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture);

                var title = target.Version > 1
                    ? "Payslip reissued"
                    : "Payslip ready";

                var message = target.Version > 1
                    ? $"Your payslip for {period} has been reissued (version {target.Version})."
                    : $"Your payslip for {period} is ready to download.";

                var notificationService = services.GetRequiredService<INotificationService>();
                await notificationService.CreateAndPushAsync(new[]
                {
                    new CreateNotificationDto
                    {
                        UserId = userId,
                        EmployeeId = target.EmployeeId,
                        Type = "Payslip",
                        Title = title,
                        Message = message,
                        Link = "/my-payslips"
                    }
                });
            }
            catch (Exception)
            {
                _logger.LogError(
                    "Payslip notification failed for payslip {PayslipId}.",
                    payslipId);
            }
        }
    }
}
