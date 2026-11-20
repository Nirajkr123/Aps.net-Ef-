using System.Security.Claims;
using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/payroll")]
    [AuthorizeRoles("OWNER", "HR")]
    public class PayrollController : ControllerBase
    {
        private readonly IPayrollService _payrollService;

        public PayrollController(IPayrollService payrollService)
        {
            _payrollService = payrollService;
        }

        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpPost("runs")]
        public Task<IActionResult> CreateRun([FromBody] CreatePayrollRunRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Payroll run details are required." });
                }

                var run = await _payrollService.CreateRunAsync(request, CurrentUserId);
                return CreatedAtAction(nameof(GetRun), new { id = run.Id }, run);
            });

        [HttpGet("runs")]
        public Task<IActionResult> GetRuns() =>
            ExecuteAsync(async () => Ok(await _payrollService.GetRunsAsync()));

        [HttpGet("runs/{id:long}")]
        public Task<IActionResult> GetRun(long id) =>
            ExecuteAsync(async () =>
            {
                var run = await _payrollService.GetRunAsync(id);
                return run is null
                    ? NotFound(new { message = "Payroll run not found." })
                    : Ok(run);
            });

        [HttpGet("runs/{id:long}/payslips")]
        public Task<IActionResult> GetRunPayslips(
            long id,
            [FromQuery] PayrollRunPayslipsQuery query) =>
            ExecuteAsync(async () => Ok(
                await _payrollService.GetRunPayslipsAsync(id, query)));

        [HttpGet("runs/{id:long}/jobs")]
        public Task<IActionResult> GetRunJobs(long id) =>
            ExecuteAsync(async () =>
            {
                var jobs = await _payrollService.GetRunJobsAsync(id);
                return jobs is null
                    ? NotFound(new { message = "Payroll run not found." })
                    : Ok(jobs);
            });

        [HttpPost("runs/{id:long}/recalculate")]
        public Task<IActionResult> Recalculate(long id) =>
            ExecuteAsync(async () =>
            {
                var run = await _payrollService.QueueRecalculationAsync(id, CurrentUserId);
                return run is null
                    ? NotFound(new { message = "Payroll run not found." })
                    : Ok(new
                    {
                        runId = run.Id,
                        message = "Payroll recalculation requested."
                    });
            });

        [HttpPost("runs/{id:long}/approve")]
        public Task<IActionResult> Approve(long id) =>
            ExecuteAsync(async () => Ok(
                await _payrollService.ApproveRunAsync(id, CurrentUserId)));

        [HttpPost("runs/{id:long}/publish")]
        public Task<IActionResult> Publish(long id) =>
            ExecuteAsync(async () => Ok(
                await _payrollService.PublishRunAsync(id, CurrentUserId)));

        [HttpGet("payslips/{id:long}")]
        public Task<IActionResult> GetPayslip(long id) =>
            ExecuteAsync(async () =>
            {
                var payslip = await _payrollService.GetPayslipAsync(id);
                return payslip is null
                    ? NotFound(new { message = "Payslip not found." })
                    : Ok(payslip);
            });

        [HttpGet("payslips/{id:long}/versions")]
        public Task<IActionResult> GetPayslipVersions(long id) =>
            ExecuteAsync(async () =>
            {
                var versions = await _payrollService.GetPayslipVersionsAsync(id);
                return versions is null
                    ? NotFound(new { message = "Payslip not found." })
                    : Ok(versions);
            });

        [HttpPost("payslips/{id:long}/reissue")]
        public Task<IActionResult> ReissuePayslip(
            long id,
            [FromBody] ReissuePayslipRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Reissue details are required." });
                }

                var payslip = await _payrollService.ReissuePayslipAsync(
                    id,
                    request,
                    CurrentUserId);

                return CreatedAtAction(
                    nameof(GetPayslip),
                    new { id = payslip.Id },
                    payslip);
            });

        [HttpPost("payslips/{id:long}/adjustments")]
        public Task<IActionResult> AddAdjustment(
            long id,
            [FromBody] AddPayslipAdjustmentRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Adjustment details are required." });
                }

                return Ok(await _payrollService.AddAdjustmentAsync(
                    id,
                    request,
                    CurrentUserId));
            });

        [HttpGet("salary-structures")]
        public Task<IActionResult> GetSalaryStructures([FromQuery] int? employeeId) =>
            ExecuteAsync(async () => Ok(
                await _payrollService.GetSalaryStructuresAsync(employeeId)));

        [HttpPost("salary-structures")]
        public Task<IActionResult> CreateSalaryStructure(
            [FromBody] CreateSalaryStructureRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Salary structure details are required." });
                }

                return Ok(await _payrollService.CreateSalaryStructureAsync(
                    request,
                    CurrentUserId));
            });

        [HttpGet("deduction-rules")]
        public Task<IActionResult> GetDeductionRules() =>
            ExecuteAsync(async () => Ok(
                await _payrollService.GetDeductionRulesAsync()));

        [HttpPost("deduction-rules")]
        public Task<IActionResult> CreateDeductionRule(
            [FromBody] CreateDeductionRuleRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Deduction rule details are required." });
                }

                return Ok(await _payrollService.CreateDeductionRuleAsync(request));
            });

        [HttpPut("deduction-rules/{id:long}")]
        public Task<IActionResult> UpdateDeductionRule(
            long id,
            [FromBody] UpdateDeductionRuleRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Deduction rule details are required." });
                }

                var rule = await _payrollService.UpdateDeductionRuleAsync(id, request);
                return rule is null
                    ? NotFound(new { message = "Deduction rule not found." })
                    : Ok(rule);
            });

        [HttpGet("holidays")]
        public Task<IActionResult> GetHolidays([FromQuery] int? year) =>
            ExecuteAsync(async () => Ok(
                await _payrollService.GetHolidaysAsync(year)));

        [HttpPost("holidays")]
        public Task<IActionResult> CreateHoliday([FromBody] CreateHolidayRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Holiday details are required." });
                }

                return Ok(await _payrollService.CreateHolidayAsync(
                    request,
                    CurrentUserId));
            });

        [HttpDelete("holidays/{id:long}")]
        public Task<IActionResult> DeleteHoliday(long id) =>
            ExecuteAsync(async () =>
            {
                var deleted = await _payrollService.DeleteHolidayAsync(id);
                return deleted
                    ? NoContent()
                    : NotFound(new { message = "Holiday not found." });
            });

        [HttpGet("week-off-days")]
        public Task<IActionResult> GetWeekOffDays() =>
            ExecuteAsync(async () => Ok(
                await _payrollService.GetWeekOffDaysAsync()));

        [HttpPut("week-off-days")]
        public Task<IActionResult> SetWeekOffDays([FromBody] SetWeekOffRequest? request) =>
            ExecuteAsync(async () =>
            {
                if (request is null)
                {
                    return BadRequest(new { message = "Week-off details are required." });
                }

                return Ok(await _payrollService.SetWeekOffDaysAsync(
                    request,
                    CurrentUserId));
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
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return Conflict(new
                {
                    message = "A record with the same values already exists."
                });
            }
        }
    }
}
