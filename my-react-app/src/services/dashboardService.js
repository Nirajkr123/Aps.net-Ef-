import http from "./http";
import adminServ from "./adminService";
import attendanceServ from "./attendanceService";
import employeeServ from "./employeeService";
import leaveServ from "./leaveService";
import payrollServ from "./payrollService";

const getSummary = () => http.get("/api/dashboard/summary");

/* =========================================================================
   OWNER / HR DASHBOARD
   -------------------------------------------------------------------------
   Abhi koi single owner-dashboard endpoint nahi hai, isliye ye service
   existing APIs ko compose karti hai. Widgets list bhi yahin se aati hai;
   frontend sirf us list par loop chalta hai.
   ========================================================================= */

const OWNER_WIDGETS = [
    "banner",
    "stats",
    "pendingRequests",
    "absentToday",
    "payroll",
    "membersByRole",
];

const ROLE_MEMBERS = [
    { key: "EMPLOYEE", label: "Employee", color: "#34d399" },
    { key: "HR", label: "HR", color: "#764ba2" },
    { key: "OWNER", label: "Admin", color: "#667eea" },
];

const DASH = "-";

const pad = (value) => String(value).padStart(2, "0");

const toISODate = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const shortDate = (value) => {
    if (!value) return "";
    const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return String(value);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
    });
};

const readUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
};

const displayNameOf = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Admin";

const nameOf = (person) =>
    [person?.firstName, person?.lastName].filter(Boolean).join(" ") || person?.employeeName || person?.email || "Employee";

const initialsOf = (name) =>
    String(name || "?")
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

const numberOrDash = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : DASH;
};

const sortNewest = (a, b) => {
    const diff = new Date(b.sortAt) - new Date(a.sortAt);
    return diff !== 0 ? diff : String(b.id).localeCompare(String(a.id));
};

const mapPendingLeave = (leave) => ({
    id: `leave-${leave.id}`,
    source: "leave",
    requestId: leave.id,
    name: leave.employeeName || "Employee",
    initials: initialsOf(leave.employeeName),
    subtitle: [
        `${leave.type || "Leave"} leave`,
        shortDate(leave.from),
        Number(leave.days) > 0
            ? `${leave.days} day${Number(leave.days) === 1 ? "" : "s"}`
            : null,
    ]
        .filter(Boolean)
        .join(" · "),
    sortAt: leave.appliedOn || leave.from,
});

const buildMembers = (roleBreakdown) => {
    const byRole = new Map(
        (roleBreakdown || []).map((row) => [String(row.role || "").toUpperCase(), Number(row.count) || 0])
    );

    return ROLE_MEMBERS.map((role) => ({
        key: role.key,
        label: role.label,
        color: role.color,
        count: byRole.has(role.key) ? numberOrDash(byRole.get(role.key)) : DASH,
    }));
};

const buildPayrollSteps = (run, payslips, jobs) => {
    const labels = ["Calculate", "Review", "Approve", "Publish"];
    const status = String(run?.status || "").toUpperCase();
    const hasActiveCalculation = (jobs || []).some(
        (job) =>
            job.type === "CALCULATE_RUN" &&
            ["QUEUED", "RUNNING", "RETRYING"].includes(String(job.status || "").toUpperCase())
    );
    const hasPayslips = (payslips || []).length > 0;

    let currentIndex = 0;
    if (status === "PUBLISHED") currentIndex = labels.length;
    else if (status === "APPROVED") currentIndex = 3;
    else if (!hasActiveCalculation && hasPayslips) currentIndex = 1;

    return labels.map((label, index) => ({
        key: label.toLowerCase(),
        label,
        state:
            index < currentIndex
                ? "done"
                : index === currentIndex
                    ? "current"
                    : "upcoming",
    }));
};

const buildPayroll = async (runs, now) => {
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const run =
        (runs || []).find(
            (item) => Number(item.month) === month && Number(item.year) === year
        ) || null;

    if (!run) {
        return { run: null, month, year, steps: [] };
    }

    let payslips = [];
    let jobs = [];

    try {
        const [payslipResponse, jobsResponse] = await Promise.all([
            payrollServ.getPayslips(run.id, { page: 1, pageSize: 1 }),
            payrollServ.getJobs(run.id),
        ]);
        payslips = Array.isArray(payslipResponse?.data?.items)
            ? payslipResponse.data.items
            : [];
        jobs = Array.isArray(jobsResponse?.data) ? jobsResponse.data : [];
    } catch {
        /* Stepper ke liye extra detail na mile to run status se best-effort. */
    }

    return {
        run: {
            id: run.id,
            month: Number(run.month) || month,
            year: Number(run.year) || year,
            status: String(run.status || "").toUpperCase(),
            netPayout: numberOrDash(run.netPayout),
            warningsCount: Number(run.warningsCount) || 0,
        },
        month,
        year,
        steps: buildPayrollSteps(run, payslips, jobs),
    };
};

const isWorkingDay = (today, holidays, weekOffDays) => {
    const todayIso = toISODate(today);
    const holiday = (holidays || []).some(
        (item) => String(item.date || "").slice(0, 10) === todayIso
    );
    const weekOff = (weekOffDays || []).map(Number).includes(today.getDay());
    return !holiday && !weekOff;
};

const getOwnerOverview = async () => {
    const now = new Date();
    const today = toISODate(now);
    const user = readUser();
    const year = now.getFullYear();

    const [
        adminResult,
        employeeResult,
        attendanceResult,
        leaveResult,
        runResult,
        holidayResult,
        weekOffResult,
    ] = await Promise.allSettled([
        adminServ.getDashboard(),
        employeeServ.getAll({ status: "Active" }),
        attendanceServ.getAll({ fromDate: today, toDate: today }),
        leaveServ.getAllLeaves({}),
        payrollServ.getRuns(),
        payrollServ.getHolidays(year),
        payrollServ.getWeekOffDays(),
    ]);

    const adminData = adminResult.status === "fulfilled" ? adminResult.value?.data : null;
    const employees =
        employeeResult.status === "fulfilled" && Array.isArray(employeeResult.value?.data)
            ? employeeResult.value.data
            : null;
    const attendance =
        attendanceResult.status === "fulfilled" && Array.isArray(attendanceResult.value?.data)
            ? attendanceResult.value.data
            : null;
    const leaves =
        leaveResult.status === "fulfilled" && Array.isArray(leaveResult.value)
            ? leaveResult.value
            : null;
    const runs =
        runResult.status === "fulfilled" && Array.isArray(runResult.value?.data)
            ? runResult.value.data
            : [];
    const holidays =
        holidayResult.status === "fulfilled" && Array.isArray(holidayResult.value?.data)
            ? holidayResult.value.data
            : null;
    const weekOffDays =
        weekOffResult.status === "fulfilled" && Array.isArray(weekOffResult.value?.data)
            ? weekOffResult.value.data
            : null;

    if (!adminData && !employees && !attendance && !leaves) {
        const failure = [adminResult, employeeResult, attendanceResult, leaveResult].find(
            (result) => result.status === "rejected"
        );
        throw (
            failure?.reason ||
            new Error("Dashboard data could not be loaded. Please try again.")
        );
    }

    const presentIds = new Set(
        (attendance || [])
            .filter(
                (record) =>
                    record?.checkInTime &&
                    !["Absent", "Leave"].includes(String(record.status || ""))
            )
            .map((record) => Number(record.employeeId))
    );

    const approvedToday = (leaves || []).filter(
        (leave) =>
            String(leave.status || "").toLowerCase() === "approved" &&
            leave.from <= today &&
            today <= leave.to
    );
    const onLeaveIds = new Set(approvedToday.map((leave) => Number(leave.employeeId)));

    const workingDay =
        holidays !== null && weekOffDays !== null
            ? isWorkingDay(now, holidays, weekOffDays)
            : true;

    const absentToday = workingDay && employees
        ? employees
              .filter((employee) => {
                  const id = Number(employee.id);
                  return !presentIds.has(id) && !onLeaveIds.has(id);
              })
              .map((employee) => {
                  const name = nameOf(employee);
                  return {
                      id: employee.id,
                      name,
                      initials: initialsOf(name),
                  };
              })
        : [];

    const pendingLeaves = (leaves || [])
        .filter((leave) => String(leave.status || "").toLowerCase() === "pending")
        .map(mapPendingLeave);

    const pendingRequests = pendingLeaves.sort(sortNewest);

    const totalEmployees = employees
        ? employees.length
        : adminData
            ? numberOrDash(adminData.totalUsers)
            : DASH;

    const payroll = await buildPayroll(runs, now);

    return {
        role: user?.role || "OWNER",
        name: displayNameOf(user),
        firstName: (displayNameOf(user).split(" ")[0] || "Admin"),
        widgets: OWNER_WIDGETS,
        stats: {
            totalEmployees,
            presentToday: attendance ? presentIds.size : DASH,
            onLeaveToday: leaves ? onLeaveIds.size : DASH,
            absentToday: workingDay ? (employees && attendance && leaves ? absentToday.length : DASH) : 0,
        },
        pendingRequests,
        absentToday,
        absentDayOff: !workingDay,
        payroll,
        members: buildMembers(adminData?.roleBreakdown),
    };
};

const dashboardService = { getSummary, getOwnerOverview };

export default dashboardService;
