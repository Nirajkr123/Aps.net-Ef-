using Microsoft.AspNetCore.Mvc;

namespace ASPCoreWebAPI.Controllers
{
    public class HolidayController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
