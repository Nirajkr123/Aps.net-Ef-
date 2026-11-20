using System.Net;
using System.Text.Json.Nodes;
using Hrms.Tests.Infrastructure;

namespace Hrms.Tests;

public sealed class FlowTests : ApiTestBase
{
    public FlowTests(TestHost host) : base(host) { }

    private static string D(int offset) => DateTime.Now.Date.AddDays(offset).ToString("yyyy-MM-dd");

    private static readonly object InsideOffice = new { latitude = 28.6139, longitude = 77.2090, accuracy = 5 };
    private static readonly object FarFromOffice = new { latitude = 28.7000, longitude = 77.3000, accuracy = 5 };

    [Fact]
    public async Task Attendance_CheckIn_CheckOut_TodayState_AndHistory()
    {
        await SeedAsync();
        Host.Clock.SetIst(6, 10);
        using var client = Employee(102);

        var stateBefore = await GetAsync(client, "/api/attendance/today-state");
        Assert.Equal(200, stateBefore.Status);

        var checkIn = await PostAsync(client, "/api/attendance/checkin", InsideOffice);
        Assert.Equal(200, checkIn.Status);
        Assert.NotNull(checkIn.Json?["checkInTime"]);

        var duplicate = await PostAsync(client, "/api/attendance/checkin", InsideOffice);
        Assert.Equal(400, duplicate.Status);

        Host.Clock.SetIst(14, 15);
        var checkOut = await PostAsync(client, "/api/attendance/checkout", InsideOffice);
        Assert.Equal(200, checkOut.Status);
        Assert.NotNull(checkOut.Json?["checkOutTime"]);

        var today = await GetAsync(client, "/api/attendance/today");
        Assert.Equal(200, today.Status);
        Assert.Equal("Present", today.Json?["status"]?.GetValue<string>());

        var history = await GetAsync(client, $"/api/attendance/my-history?fromDate={D(-1)}&toDate={D(0)}");
        Assert.Equal(200, history.Status);
        Assert.True(Count(history.Json) >= 2);
    }

    [Fact]
    public async Task Attendance_OutsideGeofence_IsRejected()
    {
        await SeedAsync();
        Host.Clock.SetIst(6, 15);
        using var client = Employee(102);

        var response = await PostAsync(client, "/api/attendance/checkin", FarFromOffice);
        Assert.Equal(400, response.Status);
    }

    [Fact]
    public async Task Attendance_ApprovedLeaveBlocksCheckIn()
    {
        await SeedAsync();
        Host.Clock.SetIst(9, 0);
        using var client = Employee(104);

        var response = await PostAsync(client, "/api/attendance/checkin", InsideOffice);
        Assert.Equal(400, response.Status);
        Assert.Equal("on_leave", response.Json?["code"]?.GetValue<string>());
    }

    [Fact]
    public async Task Attendance_EmployeeWithoutShift_GetsStateWithoutShift()
    {
        await SeedAsync();
        Host.Clock.SetIst(9, 0);
        using var client = Employee(105);

        var state = await GetAsync(client, "/api/attendance/today-state");
        Assert.Equal(200, state.Status);
        Assert.True(state.Json?["shift"] is null,
            $"Expected no shift for EMP-105, got {state.Json?["shift"]?.ToJsonString()}");
    }

    [Fact]
    public async Task Attendance_HrOverride_WritesAuditLog()
    {
        await SeedAsync();
        using var hr = Hr();

        var list = await GetAsync(hr, $"/api/attendance/all?employeeId=102&fromDate={D(-1)}&toDate={D(-1)}");
        Assert.Equal(200, list.Status);
        var record = (list.Json as JsonArray)?.FirstOrDefault();
        Assert.NotNull(record);
        var id = record!["id"]?.GetValue<long>() ?? -1;
        Assert.True(id > 0);

        var before = await ScalarAsync("SELECT count(*) FROM audit_logs");
        var update = await PutAsync(hr, $"/api/attendance/{id}", new
        {
            checkInTime = D(-1) + "T10:00:00",
            checkOutTime = D(-1) + "T19:00:00",
            status = "Present",
            reason = "Manual correction by HR"
        });
        Assert.Equal(200, update.Status);
        var after = await ScalarAsync("SELECT count(*) FROM audit_logs");
        Assert.True(after > before, "Expected an audit log entry for attendance override.");
    }

    [Fact]
    public async Task Attendance_OverrideWithoutReason_IsRejected()
    {
        await SeedAsync();
        using var hr = Hr();
        var list = await GetAsync(hr, $"/api/attendance/all?employeeId=102&fromDate={D(-1)}&toDate={D(-1)}");
        var id = (list.Json as JsonArray)?.FirstOrDefault()?["id"]?.GetValue<long>() ?? -1;

        var update = await PutAsync(hr, $"/api/attendance/{id}", new
        {
            status = "Present"
        });
        Assert.Equal(400, update.Status);
    }

    [Fact]
    public async Task WorkLocation_RadiusChange_AffectsGeofence()
    {
        await SeedAsync();
        using var hr = Hr();
        using var employee = Employee(102);

        var shrink = await PutAsync(hr, "/api/work-locations/1", new
        {
            name = "Head Office",
            latitude = 28.6139,
            longitude = 77.2090,
            radiusMeters = 50,
            isActive = true
        });
        Assert.Equal(200, shrink.Status);

        Host.Clock.SetIst(7, 0);
        var nearEdge = new { latitude = 28.6147, longitude = 77.2090, accuracy = 5 };
        var blocked = await PostAsync(employee, "/api/attendance/checkin", nearEdge);
        Assert.Equal(400, blocked.Status);

        var restore = await PutAsync(hr, "/api/work-locations/1", new
        {
            name = "Head Office",
            latitude = 28.6139,
            longitude = 77.2090,
            radiusMeters = 100,
            isActive = true
        });
        Assert.Equal(200, restore.Status);

        var allowed = await PostAsync(employee, "/api/attendance/checkin", nearEdge);
        Assert.Equal(200, allowed.Status);
    }

    [Fact]
    public async Task Leaves_BalanceApplyCancel_AndValidation()
    {
        await SeedAsync();
        using var client = Employee(102);

        var balance = await GetAsync(client, "/api/leaves/balance");
        Assert.Equal(200, balance.Status);
        Assert.Equal(4, balance.Json?["balance"]?.AsObject().Count);
        Assert.Equal(30, balance.Json?["total"]?.GetValue<int>());

        Assert.Equal(400, (await PostAsync(client, "/api/leaves", new
        {
            type = "Unknown",
            from = D(10),
            to = D(10),
            reason = "This is a long enough reason"
        })).Status);

        Assert.Equal(400, (await PostAsync(client, "/api/leaves", new
        {
            type = "Casual",
            from = D(12),
            to = D(10),
            reason = "This is a long enough reason"
        })).Status);

        Assert.Equal(400, (await PostAsync(client, "/api/leaves", new
        {
            type = "Casual",
            from = D(10),
            to = D(10),
            reason = "short"
        })).Status);

        var applied = await PostAsync(client, "/api/leaves", new
        {
            type = "Casual",
            from = D(10),
            to = D(11),
            reason = "Family event out of town"
        });
        Assert.Equal(201, applied.Status);
        var leaveId = applied.Json?["id"]?.GetValue<int>() ?? -1;
        Assert.True(leaveId > 0);
        Assert.Equal(2, applied.Json?["days"]?.GetValue<int>());

        var cancel = await PatchAsync(client, $"/api/leaves/{leaveId}/cancel");
        Assert.Equal(200, cancel.Status);
        Assert.Equal(409, (await PatchAsync(client, $"/api/leaves/{leaveId}/cancel")).Status);

        var overlap = await PostAsync(client, "/api/leaves", new
        {
            type = "Casual",
            from = D(5),
            to = D(6),
            reason = "Overlaps with pending request"
        });
        Assert.True(overlap.Status is 400 or 409);

        var over = await PostAsync(client, "/api/leaves", new
        {
            type = "Sick",
            from = D(20),
            to = D(28),
            reason = "Medical treatment and recovery"
        });
        Assert.Equal(400, over.Status);
    }

    [Fact]
    public async Task Leaves_ApplyForToday_IsAllowed()
    {
        await SeedAsync();
        using var client = Employee(102);

        var applied = await PostAsync(client, "/api/leaves", new
        {
            type = "Casual",
            from = D(0),
            to = D(0),
            reason = "Urgent personal work today"
        });
        Assert.Equal(201, applied.Status);
        Assert.Equal(400, (await PostAsync(client, "/api/leaves", new
        {
            type = "Casual",
            from = D(-1),
            to = D(-1),
            reason = "Backdated leave request"
        })).Status);
    }

    [Fact]
    public async Task Leaves_HalfDay_IsNotSupported()
    {
        await SeedAsync();
        using var client = Employee(102);

        var applied = await PostAsync(client, "/api/leaves", new
        {
            type = "Casual",
            from = D(15),
            to = D(15),
            halfDay = true,
            reason = "Half day for personal errand"
        });
        Assert.Equal(201, applied.Status);
        Assert.Equal(1, applied.Json?["days"]?.GetValue<int>());
        Assert.True(applied.Json?["halfDay"] is null,
            "Half-day flag should be modelled end-to-end when supported.");
    }

    [Fact]
    public async Task Leaves_Approve_Reject_AndIdor()
    {
        await SeedAsync();
        using var hr = Hr();
        using var employee = Employee(102);

        Assert.Equal(403, (await PatchAsync(employee, "/api/leaves/2/approve")).Status);

        var approve = await PatchAsync(hr, "/api/leaves/2/approve");
        Assert.Equal(200, approve.Status);
        Assert.Equal("Approved", approve.Json?["status"]?.GetValue<string>());
        Assert.Equal(409, (await PatchAsync(hr, "/api/leaves/2/approve")).Status);

        var mine = await GetAsync(employee, "/api/leaves/my");
        Assert.Equal(200, mine.Status);
        Assert.Contains("\"status\":\"Approved\"", mine.Text);

        var applied = await PostAsync(employee, "/api/leaves", new
        {
            type = "Personal",
            from = D(25),
            to = D(25),
            reason = "Personal commitment for the day"
        });
        var rejectId = applied.Json?["id"]?.GetValue<int>() ?? -1;
        Assert.True(rejectId > 0);

        var noComment = await PatchAsync(hr, $"/api/leaves/{rejectId}/reject", new { comment = "" });
        Assert.Equal(400, noComment.Status);

        var rejected = await PatchAsync(hr, $"/api/leaves/{rejectId}/reject", new
        {
            comment = "Insufficient coverage that week"
        });
        Assert.Equal(200, rejected.Status);
        Assert.Equal("Rejected", rejected.Json?["status"]?.GetValue<string>());
    }

    [Fact]
    public async Task Leaves_EmployeeCannotSeeOthers()
    {
        await SeedAsync();
        using var employee = Employee(103);

        Assert.Equal(403, (await GetAsync(employee, "/api/leaves/1")).Status);

        var list = await GetAsync(employee, "/api/leaves?employeeId=102");
        Assert.Equal(200, list.Status);
        var items = (list.Json as JsonObject)?["items"] as JsonArray;
        Assert.NotNull(items);
        Assert.All(items!, item => Assert.Equal(103, item?["employeeId"]?.GetValue<int>()));
    }

    private static JsonArray? ItemsOf(JsonNode? node)
    {
        if (node is JsonArray array) return array;
        if (node is JsonObject obj && obj["items"] is JsonArray items) return items;
        return null;
    }

    [Fact]
    public async Task Payroll_RunLifecycle_AndImmutability()
    {
        await SeedAsync();
        using var hr = Hr();

        var runs = await GetAsync(hr, "/api/payroll/runs");
        Assert.Equal(200, runs.Status);
        Assert.Equal(2, ItemsOf(runs.Json)?.Count);

        Assert.Equal(409, (await PostAsync(hr, "/api/payroll/payslips/1/adjustments", new
        {
            type = "BONUS",
            amount = 1000,
            note = "Should be blocked"
        })).Status);

        var approve = await PostAsync(hr, "/api/payroll/runs/2/approve");
        Assert.Equal(200, approve.Status);

        Assert.Equal(409, (await PostAsync(hr, "/api/payroll/payslips/3/adjustments", new
        {
            type = "BONUS",
            amount = 1000,
            note = "Blocked after approval"
        })).Status);

        var publish = await PostAsync(hr, "/api/payroll/runs/2/publish");
        Assert.Equal(200, publish.Status);
        Assert.Equal(409, (await PostAsync(hr, "/api/payroll/runs/2/publish")).Status);

        var detail = await GetAsync(hr, "/api/payroll/runs/2");
        Assert.Equal(200, detail.Status);
        Assert.Equal("PUBLISHED", detail.Json?["status"]?.GetValue<string>());

        Assert.Equal(404, (await GetAsync(hr, "/api/payroll/runs/999999")).Status);
    }

    [Fact]
    public async Task Payroll_DraftAdjustment_IsAllowed_AndQueuesJob()
    {
        await SeedAsync();
        using var hr = Hr();

        var adjustment = await PostAsync(hr, "/api/payroll/payslips/3/adjustments", new
        {
            type = "BONUS",
            amount = 2500,
            note = "Quarterly bonus"
        });
        Assert.Equal(200, adjustment.Status);
        Assert.True((adjustment.Json?["adjustmentId"]?.GetValue<long>() ?? 0) > 0);

        var payslip = await GetAsync(hr, "/api/payroll/payslips/3");
        Assert.Equal(200, payslip.Status);
        Assert.True((adjustment.Json?["jobId"]?.GetValue<long>() ?? 0) > 0,
            "A recalculate job should be queued after adding an adjustment.");
    }

    [Fact]
    public async Task Payroll_NewRun_ValidationAndDuplicates()
    {
        await SeedAsync();
        using var hr = Hr();

        var month = Convert.ToInt32(await TestDb.ValueAsync("SELECT month FROM payroll_runs WHERE id = 2"));
        var year = Convert.ToInt32(await TestDb.ValueAsync("SELECT year FROM payroll_runs WHERE id = 2"));

        Assert.Equal(409, (await PostAsync(hr, "/api/payroll/runs", new { month, year })).Status);

        var future = DateTime.Now.Date.AddMonths(2);
        Assert.Equal(400, (await PostAsync(hr, "/api/payroll/runs", new
        {
            month = future.Month,
            year = future.Year
        })).Status);

        var invalidMonth = await PostAsync(hr, "/api/payroll/runs", new { month = 13, year = 2026 });
        Assert.Equal(400, invalidMonth.Status);

        var created = await PostAsync(hr, "/api/payroll/runs", new
        {
            month = DateTime.Now.Date.AddMonths(-3).Month,
            year = DateTime.Now.Date.AddMonths(-3).Year
        });
        Assert.True(created.Status is 200 or 201);
    }

    [Fact]
    public async Task Payroll_Holidays_AndWeekOff_Rules()
    {
        await SeedAsync();
        using var hr = Hr();

        var holidays = await GetAsync(hr, "/api/payroll/holidays");
        Assert.Equal(200, holidays.Status);
        Assert.True(Count(holidays.Json) >= 1);

        var seeded = holidays.Json![0]!;
        var date = seeded["date"]?.GetValue<string>()?.Substring(0, 10);
        Assert.NotNull(date);

        Assert.Equal(409, (await PostAsync(hr, "/api/payroll/holidays", new
        {
            date,
            name = "Duplicate Holiday"
        })).Status);

        Assert.Equal(400, (await PostAsync(hr, "/api/payroll/holidays", new
        {
            date = "",
            name = ""
        })).Status);

        Assert.Equal(400, (await PutAsync(hr, "/api/payroll/week-off-days", new { days = new[] { 7 } })).Status);

        var valid = await PutAsync(hr, "/api/payroll/week-off-days", new { days = new[] { 0, 6 } });
        Assert.Equal(200, valid.Status);
    }

    [Fact]
    public async Task Payroll_SalaryStructure_Validation()
    {
        await SeedAsync();
        using var hr = Hr();

        var negative = await PostAsync(hr, "/api/payroll/salary-structures", new
        {
            employeeId = 105,
            basic = -1,
            hra = 0,
            allowances = 0,
            effectiveFrom = D(0)
        });
        Assert.Equal(400, negative.Status);

        var missing = await PostAsync(hr, "/api/payroll/salary-structures", new
        {
            employeeId = 999999,
            basic = 100,
            hra = 0,
            allowances = 0,
            effectiveFrom = D(0)
        });
        Assert.True(missing.Status is 400 or 404);
    }

    [Fact]
    public async Task AdminDashboard_CountsStayConsistent()
    {
        await SeedAsync();
        using var hr = Hr();

        var employees = await GetAsync(hr, "/api/Employee?status=Active");
        Assert.Equal(200, employees.Status);
        Assert.Equal(5, Count(employees.Json));

        var today = await GetAsync(hr, $"/api/attendance/all?fromDate={D(0)}&toDate={D(0)}");
        Assert.Equal(200, today.Status);
        var records = today.Json as JsonArray;
        Assert.NotNull(records);

        var onLeave = records!.Count(r =>
            string.Equals(r?["status"]?.GetValue<string>(), "Leave", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(1, onLeave);

        var present = records.Count(r => r?["checkInTime"] is not null);
        Assert.Equal(0, present);

        Host.Clock.SetIst(6, 20);
        using var employee = Employee(102);
        Assert.Equal(200, (await PostAsync(employee, "/api/attendance/checkin", InsideOffice)).Status);

        var after = await GetAsync(hr, $"/api/attendance/all?fromDate={D(0)}&toDate={D(0)}");
        var afterRecords = after.Json as JsonArray;
        Assert.Equal(1, afterRecords!.Count(r => r?["checkInTime"] is not null));
    }

    [Fact]
    public async Task EmployeeDashboard_SummaryIsScopedToSelf()
    {
        await SeedAsync();
        using var employee = Employee(102);

        var summary = await GetAsync(employee, "/api/dashboard/summary");
        Assert.Equal(200, summary.Status);
        Assert.Equal("EMPLOYEE", summary.Json?["role"]?.GetValue<string>());
        Assert.Equal(102, summary.Json?["employee"]?["id"]?.GetValue<int>());
        Assert.NotNull(summary.Json?["leave"]);
        Assert.NotNull(summary.Json?["widgets"]);
    }

    [Fact]
    public async Task E2E_CreateEmployee_DepartmentRenameAndLogin()
    {
        await SeedAsync();
        using var hr = Hr();
        using var owner = Owner();

        var created = await PostAsync(hr, "/api/Employee", new
        {
            firstName = "E2e",
            lastName = "Flow",
            email = "e2e.flow@hrms-test.local",
            departmentId = 1,
            designationId = 2,
            joiningDate = D(0),
            employmentType = "FULL_TIME"
        });
        Assert.Equal(200, created.Status);

        var rename = await PutAsync(owner, "/api/Department/1", new
        {
            name = "Platform Engineering",
            description = "Renamed in E2E",
            status = "Active"
        });
        Assert.Equal(200, rename.Status);

        using var anonymous = Anonymous();
        var login = await PostAsync(anonymous, "/api/User/login", new
        {
            email = "e2e.flow@hrms-test.local",
            password = "Employee@123"
        });
        Assert.Equal(200, login.Status);
        var token = login.Json?["token"]?.GetValue<string>();

        using var self = Anonymous();
        self.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var me = await GetAsync(self, "/api/Employee/me");
        Assert.Equal(200, me.Status);
        Assert.Equal("Platform Engineering", me.Json?["departmentName"]?.GetValue<string>());
    }

    [Fact]
    public async Task AssignedShift_AppearsOnEmployeeProfile()
    {
        await SeedAsync();
        using var hr = Hr();
        using var employee = Employee(105);

        var before = await GetAsync(employee, "/api/Employee/me");
        Assert.Equal(200, before.Status);
        Assert.True(before.Json?["shiftName"] is null);

        var assigned = await PostAsync(hr, "/api/shift-assignments/bulk", new
        {
            shiftId = 1,
            fromDate = D(1),
            toDate = D(1),
            employeeIds = new[] { 105 }
        });
        Assert.Equal(200, assigned.Status);

        var after = await GetAsync(employee, "/api/Employee/me");
        Assert.Equal("Morning", after.Json?["shiftName"]?.GetValue<string>());
        Assert.Equal("06:00 – 14:00", after.Json?["shiftTiming"]?.GetValue<string>());

        var adminView = await GetAsync(hr, "/api/Employee/105");
        Assert.Equal("Morning", adminView.Json?["shiftName"]?.GetValue<string>());
    }

    [Fact]
    public async Task Security_LongDepartmentName_Rejected()
    {
        await SeedAsync();
        using var owner = Owner();

        var longName = new string('Z', 200);
        var response = await PostAsync(owner, "/api/Department", new { name = longName });
        Assert.Equal(400, response.Status);
    }

    [Fact]
    public async Task Security_NegativeAndZeroPayrollValues_Rejected()
    {
        await SeedAsync();
        using var hr = Hr();

        Assert.Equal(400, (await PostAsync(hr, "/api/payroll/payslips/3/adjustments", new
        {
            type = "BONUS",
            amount = -50,
            note = "Negative adjustment"
        })).Status);

        Assert.Equal(400, (await PostAsync(hr, "/api/payroll/payslips/3/adjustments", new
        {
            type = "HACK",
            amount = 10,
            note = "Unknown type"
        })).Status);
    }

}
