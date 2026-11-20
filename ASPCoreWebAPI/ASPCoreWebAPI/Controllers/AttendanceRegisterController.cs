using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/attendance/register")]
    [AuthorizeRoles("OWNER", "HR", "EMPLOYEE")]
    public class AttendanceRegisterController : ControllerBase
    {
        private readonly IAttendanceRegisterService _service;
        private readonly IAttendanceRegisterRepository _repo;

        public AttendanceRegisterController(
            IAttendanceRegisterService service,
            IAttendanceRegisterRepository repo)
        {
            _service = service;
            _repo = repo;
        }

        private int UserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        private int? EmployeeId =>
            int.TryParse(User.FindFirst("employee_id")?.Value, out var id) ? id : null;

        private string Role =>
            User.FindFirst(ClaimTypes.Role)?.Value ?? "EMPLOYEE";

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] AttendanceRegisterQuery query)
        {
            try
            {
                return Ok(await _service.GetRegisterAsync(query, await BuildActorAsync()));
            }
            catch (AttendanceRegisterForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (AttendanceRegisterValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("cell/{employeeId:int}/{date}")]
        public async Task<IActionResult> GetCell(int employeeId, string date)
        {
            try
            {
                return Ok(await _service.GetCellAsync(employeeId, date, await BuildActorAsync()));
            }
            catch (AttendanceRegisterForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (AttendanceRegisterValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("mark")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Mark([FromBody] AttendanceRegisterMarkRequest request)
        {
            try
            {
                await _service.MarkAsync(request, await BuildActorAsync());
                return Ok(new { message = "Attendance updated." });
            }
            catch (AttendanceRegisterForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (AttendanceRegisterValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (AttendanceRegisterConflictException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpPost("lock")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Lock([FromBody] AttendanceRegisterLockRequest request)
        {
            try
            {
                return Ok(await _service.LockAsync(request, await BuildActorAsync()));
            }
            catch (AttendanceRegisterForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (AttendanceRegisterValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("lock-history")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> LockHistory([FromQuery] string month)
        {
            try
            {
                return Ok(await _service.GetLockHistoryAsync(month));
            }
            catch (AttendanceRegisterValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            return Ok(await _repo.GetSettingsAsync());
        }

        [HttpPut("settings")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> UpdateSettings(
            [FromBody] AttendanceRegisterSettingsUpdateRequest request)
        {
            try
            {
                return Ok(await _service.UpdateSettingsAsync(request, await BuildActorAsync()));
            }
            catch (AttendanceRegisterForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
        }

        [HttpGet("export")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> Export([FromQuery] AttendanceRegisterQuery query)
        {
            query.Page = 1;
            query.PageSize = 200;

            try
            {
                var data = await _service.GetRegisterAsync(query, await BuildActorAsync());
                var csv = BuildCsv(data);
                return File(
                    Encoding.UTF8.GetBytes(csv),
                    "text/csv",
                    $"attendance-register-{data.Month}.csv");
            }
            catch (AttendanceRegisterForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (AttendanceRegisterValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("payroll-totals")]
        [AuthorizeRoles("OWNER", "HR")]
        public async Task<IActionResult> PayrollTotals([FromQuery] string month)
        {
            try
            {
                return Ok(await _service.GetPayrollTotalsAsync(month));
            }
            catch (AttendanceRegisterValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private async Task<RegisterActor> BuildActorAsync()
        {
            var employeeId = EmployeeId;
            var managed = employeeId.HasValue
                ? await _repo.GetManagedEmployeeIdsAsync(employeeId.Value)
                : new HashSet<int>();

            return new RegisterActor
            {
                UserId = UserId,
                EmployeeId = employeeId,
                Role = Role,
                IsManager = managed.Count > 0,
                ManagedEmployeeIds = managed
            };
        }

        private static string BuildCsv(AttendanceRegisterResponse data)
        {
            var builder = new StringBuilder();
            builder.Append("Employee Code,Employee Name,Department,Location");
            foreach (var day in Enumerable.Range(1, data.DaysInMonth))
                builder.Append($",{day:D2}");
            builder.AppendLine(",Present,Late,Half Day,Absent,Paid Leave,Unpaid Leave,Holiday,Week Off,LOP,Payable");

            foreach (var row in data.Items)
            {
                builder.Append(Csv(row.EmployeeCode)).Append(',')
                    .Append(Csv(row.EmployeeName)).Append(',')
                    .Append(Csv(row.DepartmentName ?? string.Empty)).Append(',')
                    .Append(Csv(row.LocationName ?? string.Empty));

                foreach (var day in row.Days)
                    builder.Append(',').Append(Csv(day.Code));

                builder.Append(',')
                    .Append(row.Totals.Present).Append(',')
                    .Append(row.Totals.Late).Append(',')
                    .Append(row.Totals.HalfDay).Append(',')
                    .Append(row.Totals.Absent).Append(',')
                    .Append(row.Totals.PaidLeave).Append(',')
                    .Append(row.Totals.UnpaidLeave).Append(',')
                    .Append(row.Totals.Holiday).Append(',')
                    .Append(row.Totals.WeekOff).Append(',')
                    .Append(row.Totals.LopDays).Append(',')
                    .Append(row.Totals.PayableDays)
                    .AppendLine();
            }

            return builder.ToString();
        }

        private static string Csv(string value)
        {
            if (value.Contains('"') || value.Contains(',') || value.Contains('\n'))
                return $"\"{value.Replace("\"", "\"\"")}\"";
            return value;
        }
    }
}
