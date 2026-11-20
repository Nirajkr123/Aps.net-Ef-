using System.Security.Claims;
using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/me/payslips")]
    [Route("api/payslip")]
    [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
    public class EmployeePayslipController : ControllerBase
    {
        private const string NoEmployeeMessage =
            "No employee record is linked to this account yet. " +
            "Contact HR to complete your profile.";

        private readonly IPayrollService _payrollService;
        private readonly IEmployeeRepository _employeeRepository;

        public EmployeePayslipController(
            IPayrollService payrollService,
            IEmployeeRepository employeeRepository)
        {
            _payrollService = payrollService;
            _employeeRepository = employeeRepository;
        }

        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        private async Task<int?> GetCurrentEmployeeIdAsync()
        {
            var employeeIdClaim = User.FindFirst("employee_id")?.Value;

            if (int.TryParse(employeeIdClaim, out var employeeId))
            {
                return employeeId;
            }

            var employee = await _employeeRepository.GetByUserIdAsync(CurrentUserId);
            return employee?.Id;
        }

        [HttpGet("")]
        [HttpGet("my")]
        public Task<IActionResult> GetMyPayslips([FromQuery] int? year) =>
            ExecuteAsync(async () =>
            {
                var employeeId = await GetCurrentEmployeeIdAsync();
                if (employeeId is null)
                {
                    return NotFound(new { message = NoEmployeeMessage });
                }

                return Ok(await _payrollService.GetMyPayslipsAsync(employeeId.Value, year));
            });

        [HttpGet("latest")]
        public Task<IActionResult> GetLatestPayslip() =>
            ExecuteAsync(async () =>
            {
                var employeeId = await GetCurrentEmployeeIdAsync();
                if (employeeId is null)
                {
                    return NotFound(new { message = NoEmployeeMessage });
                }

                var payslip = await _payrollService.GetMyLatestPayslipAsync(employeeId.Value);
                return payslip is null
                    ? NotFound(new { message = "No published payslip is available yet." })
                    : Ok(payslip);
            });

        [HttpGet("{id:long}")]
        public Task<IActionResult> GetPayslip(long id) =>
            ExecuteAsync(async () =>
            {
                var employeeId = await GetCurrentEmployeeIdAsync();
                if (employeeId is null)
                {
                    return NotFound(new { message = NoEmployeeMessage });
                }

                var payslip = await _payrollService.GetMyPayslipAsync(employeeId.Value, id);
                return payslip is null
                    ? NotFound(new { message = "Payslip not found." })
                    : Ok(payslip);
            });

        [HttpGet("download/{id:long}")]
        [HttpGet("{id:long}/download")]
        public Task<IActionResult> DownloadPayslip(long id) =>
            ExecuteAsync(async () =>
            {
                var employeeId = await GetCurrentEmployeeIdAsync();
                if (employeeId is null)
                {
                    return NotFound(new { message = NoEmployeeMessage });
                }

                var file = await _payrollService.GetMyPayslipDownloadAsync(
                    employeeId.Value,
                    id,
                    HttpContext.RequestAborted);

                if (file is null)
                {
                    return NotFound(new { message = "Payslip not found." });
                }

                Response.Headers["Cache-Control"] = "private, no-store";
                return PhysicalFile(
                    file.FullPath,
                    "application/pdf",
                    file.FileName,
                    enableRangeProcessing: true);
            });

        private async Task<IActionResult> ExecuteAsync(Func<Task<IActionResult>> action)
        {
            try
            {
                return await action();
            }
            catch (PayrollValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (PayrollConflictException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (PayrollNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }
    }
}
