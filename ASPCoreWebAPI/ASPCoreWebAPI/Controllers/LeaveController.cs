using System.Security.Claims;
using ASPCoreWebAPI.Middleware;
using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/leaves")]
    [Authorize]
    public class LeaveController : ControllerBase
    {
        private readonly ILeaveService _leaveService;
        private readonly IEmployeeRepository _employeeRepository;

        public LeaveController(
            ILeaveService leaveService,
            IEmployeeRepository employeeRepository)
        {
            _leaveService = leaveService;
            _employeeRepository = employeeRepository;
        }

        /* =================================================================
           Identity helpers
           -----------------------------------------------------------------
           `employeeId` KABHI body ya query se nahi aata — hamesha token se.
           Isi liye `employee_id` claim pehle prefer karte hain (JWT me hota
           hai), aur fallback me user se employee dhoondhte hain (purane
           tokens me claim na ho to bhi kaam kare).

           `?employeeId=` sirf ADMIN list me maani jaati hai, aur wahan bhi
           service level par role check ho chuka hota hai. */
        private int CurrentUserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        private bool IsReviewer =>
            User.IsInRole("HR") || User.IsInRole("OWNER");

        private string ReviewerName
        {
            get
            {
                var first = User.FindFirst("firstName")?.Value ?? string.Empty;
                var last = User.FindFirst("lastName")?.Value ?? string.Empty;
                var name = $"{first} {last}".Trim();

                return string.IsNullOrWhiteSpace(name)
                    ? (User.FindFirst(ClaimTypes.Email)?.Value ?? "Administrator")
                    : name;
            }
        }

        /* Current user ka Employee row. Employee record na ho to 404 +
           clear message — "logged in but not an employee" situation. */
        private async Task<Employee?> GetCurrentEmployeeAsync()
        {
            var employeeIdClaim = User.FindFirst("employee_id")?.Value;
            Employee? employee = null;

            if (int.TryParse(employeeIdClaim, out var employeeId))
            {
                employee = await _employeeRepository.GetByIdAsync(employeeId);
            }

            employee ??= await _employeeRepository.GetByUserIdAsync(CurrentUserId);
            return employee;
        }

        private const string NoEmployeeMessage =
            "No employee record is linked to this account yet. " +
            "Contact HR to complete your profile.";

        // =====================================================================
        //  GET /api/leaves/my
        //  Employee ki apni leaves — nayi applied sabse upar.
        // =====================================================================
        [HttpGet("my")]
        [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
        public async Task<IActionResult> GetMyLeaves()
        {
            var employee = await GetCurrentEmployeeAsync();
            if (employee == null) return NotFound(new { message = NoEmployeeMessage });

            var leaves = await _leaveService.GetMyLeavesAsync(employee.Id);
            return Ok(leaves);
        }

        // =====================================================================
        //  GET /api/leaves/balance
        //  Employee apna balance (bina ?employeeId ke).
        // =====================================================================
        [HttpGet("balance")]
        [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
        public async Task<IActionResult> GetBalance()
        {
            var employee = await GetCurrentEmployeeAsync();
            if (employee == null) return NotFound(new { message = NoEmployeeMessage });

            var balance = await _leaveService.GetBalanceAsync(employee.Id);
            return Ok(balance);
        }

        // =====================================================================
        //  GET /api/leaves?employeeId=
        //  Employee: sirf apni list. Reviewer: filters ke saath poori list.
        // =====================================================================
        [HttpGet]
        [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
        public async Task<IActionResult> GetAll([FromQuery] LeaveQuery query)
        {
            var employee = await GetCurrentEmployeeAsync();
            if (employee == null) return NotFound(new { message = NoEmployeeMessage });

            if (!IsReviewer)
            {
                /* Non-admin ne kisi aur ka data maanga to chup-chaap apni
                   list par force kar dete hain (403 se better UX, aur koi
                   data leak nahi hota). */
                var mine = await _leaveService.GetListAsync(query, employee.Id);
                return Ok(mine);
            }

            /* Admin drawer me "?employeeId=" bhejta hai; warna poora org. */
            int? targetEmployeeId = query.EmployeeId;

            if (targetEmployeeId.HasValue)
            {
                var exists = await _employeeRepository.GetByIdAsync(targetEmployeeId.Value);
                if (exists == null)
                {
                    return NotFound(new { message = "Employee not found" });
                }
            }

            var response = await _leaveService.GetListAsync(query, targetEmployeeId);
            return Ok(response);
        }

        // =====================================================================
        //  GET /api/leaves/{id}
        //  Details drawer ke liye.
        // =====================================================================
        [HttpGet("{id:int}")]
        [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
        public async Task<IActionResult> GetById(int id)
        {
            var leave = await _leaveService.GetByIdAsync(id);
            if (leave == null)
            {
                return NotFound(new { message = "Leave request not found" });
            }

            /* Employee doosre ka record nahi dekh sakta. */
            if (!IsReviewer)
            {
                var employee = await GetCurrentEmployeeAsync();
                if (employee == null) return NotFound(new { message = NoEmployeeMessage });

                if (leave.EmployeeId != employee.Id)
                {
                    return Forbid();
                }
            }

            return Ok(leave);
        }

        // =====================================================================
        //  POST /api/leaves
        //  Apply. `employeeId` body se nahi — token se.
        /* Service ke `LeaveResult.Kind` ko HTTP status me map karta hai:
             Validation → 400  (galat input / rule violation)
             Conflict   → 409  (record hai par state badal chuki hai)
             NotFound   → 404  (record hi nahi)

           Frontend dono 400 aur 409 ko inline error ki tarah dikhata hai,
           bas message alag hota hai. */
        private IActionResult ToHttpError(LeaveResult result) => result.Kind switch
        {
            LeaveErrorKind.Conflict => Conflict(new { message = result.Error }),
            LeaveErrorKind.NotFound => NotFound(new { message = result.Error }),
            _ => BadRequest(new { message = result.Error }),
        };

        // =====================================================================
        [HttpPost]
        [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
        public async Task<IActionResult> Apply([FromBody] LeaveCreateRequest request)
        {
            var employee = await GetCurrentEmployeeAsync();
            if (employee == null) return NotFound(new { message = NoEmployeeMessage });

            var result = await _leaveService.ApplyAsync(employee.Id, request);
            if (!result.Ok) return ToHttpError(result);

            return CreatedAtAction(nameof(GetById), new { id = result.Leave!.Id }, result.Leave);
        }

        // =====================================================================
        //  PATCH /api/leaves/{id}/cancel
        //  Employee apna Pending record cancel karta hai.
        // =====================================================================
        [HttpPatch("{id:int}/cancel")]
        [AuthorizeRoles("EMPLOYEE", "HR", "OWNER")]
        public async Task<IActionResult> Cancel(int id)
        {
            var employee = await GetCurrentEmployeeAsync();
            if (employee == null) return NotFound(new { message = NoEmployeeMessage });

            var result = await _leaveService.CancelAsync(id, employee.Id);
            if (!result.Ok) return ToHttpError(result);

            return Ok(result.Leave);
        }

        // =====================================================================
        //  PATCH /api/leaves/{id}/approve
        //  Sirf HR / OWNER. Balance yahin kat-ta hai.
        // =====================================================================
        [HttpPatch("{id:int}/approve")]
        [AuthorizeRoles("HR", "OWNER")]
        public async Task<IActionResult> Approve(int id)
        {
            var result = await _leaveService.ApproveAsync(id, ReviewerName);
            if (!result.Ok) return ToHttpError(result);

            return Ok(result.Leave);
        }

        // =====================================================================
        //  PATCH /api/leaves/{id}/reject
        //  Sirf HR / OWNER. `comment` mandatory.
        // =====================================================================
        [HttpPatch("{id:int}/reject")]
        [AuthorizeRoles("HR", "OWNER")]
        public async Task<IActionResult> Reject(int id, [FromBody] LeaveRejectRequest request)
        {
            var result = await _leaveService.RejectAsync(id, ReviewerName, request.Comment);
            if (!result.Ok) return ToHttpError(result);

            return Ok(result.Leave);
        }
    }
}
