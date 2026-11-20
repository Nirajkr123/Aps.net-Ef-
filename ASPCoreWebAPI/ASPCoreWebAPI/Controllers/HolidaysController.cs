using ASPCoreWebAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class HolidaysController : ControllerBase
    {
        private readonly IPayrollService _payrollService;

        public HolidaysController(IPayrollService payrollService)
        {
            _payrollService = payrollService;
        }

        [HttpGet("upcoming")]
        public async Task<IActionResult> GetUpcoming()
        {
            var today = DateTime.Today;
            var holidays = await _payrollService.GetHolidaysAsync(null);

            return Ok(holidays
                .Where(holiday => holiday.Date.Date >= today)
                .OrderBy(holiday => holiday.Date)
                .ToList());
        }
    }
}
