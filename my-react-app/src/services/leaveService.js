/* =========================================================================
   LEAVE SERVICE  —  the ONLY file that knows where leave data comes from
   -------------------------------------------------------------------------
   Data ab ASPCoreWebAPI (`/api/leaves`) se aa raha hai. Is file ka kaam sirf
   "UI ka shape" aur "API ka shape" ke beech translate karna hai — components
   aur context ko inhi function names se hi baat karni hai, unhe kuch nahi
   pata chalega.

   -------------------------------------------------------------------------
   1) DATA MODEL  (ye shape API se aati hai, waisi hi wapas jaati hai)
   -------------------------------------------------------------------------
   leave = {
      id,            // number
      employeeId,    // number   (Employees.Id — user.id NAHI)
      employeeName,  // string   (admin list me search/avatar ke liye denormalised)
      type,          // 'Casual' | 'Sick' | 'Earned' | 'Personal'
      from,          // 'YYYY-MM-DD'
      to,            // 'YYYY-MM-DD'
      days,          // number   (SAB din gin-te hain, weekend included)
      reason,        // string
      status,        // 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
      appliedOn,     // ISO datetime
      reviewedBy,    // string | null
      reviewedOn,    // ISO datetime | null
      adminComment,  // string | null   (reject hone par reason)
    }

   balance = {
      Casual:  { total, used },
      Sick:    { total, used },
      Earned:  { total, used },
      Personal:{ total, used },
    }

   IMPORTANT: `used` sirf APPROVED leave par badhta hai. Apply karte waqt
   aur Reject/Cancel par kuch nahi kat-ta — isiliye "Remaining" dikhate waqt
   pending days alag se note karte hain.

   -------------------------------------------------------------------------
   2) API (implemented — ASP.NET Core)
   -------------------------------------------------------------------------
   POST   /api/leaves              -> 201 leave         (status 'Pending')
   GET    /api/leaves/my           -> 200 [ leave ]
   GET    /api/leaves?status=&search=&type=&from=&to=&employeeId=
                                   -> 200 { items:[...], total, pendingCount, ... }
   PATCH  /api/leaves/:id/cancel   -> 200 leave         (status 'Cancelled')
   PATCH  /api/leaves/:id/approve  -> 200 leave         (status 'Approved')
   PATCH  /api/leaves/:id/reject   -> 200 leave         (body: { comment })
   GET    /api/leaves/balance      -> 200 balance

   Saare rules server par hain (validation, quota, overlap, role, status) —
   client validation sirf UX ke liye hai, asli guard backend ka hai.

   -------------------------------------------------------------------------
   3) ERROR SHAPE
   -------------------------------------------------------------------------
   Backend `{ message }` deta hai. `toApiError` usse Error me badalta hai
   aur `err.field` lagata hai, jisse dialog us field ke neeche inline error
   dikha sake (bina poora form invalid bolke).
   ========================================================================= */

import http from "./http";

/* -------------------------------------------------------------------------
   Leave types + their yearly quota (total days)

   Backend ka mirror `LeaveQuota.cs` me hai — dono ki values match karni
   chahiye, warna dialog "Casual (12 left)" dikhaye aur server reject kar de.
   -------------------------------------------------------------------------- */

export const LEAVE_TYPES = ["Casual", "Sick", "Earned", "Personal"];

export const LEAVE_TYPE_META = {
    Casual: { label: "Casual Leave", color: "#4f46e5" },
    Sick: { label: "Sick Leave", color: "#dc2626" },
    Earned: { label: "Earned Leave", color: "#059669" },
    Personal: { label: "Personal Leave", color: "#d97706" },
};

export const LEAVE_QUOTAS = {
    Casual: 12,
    Sick: 8,
    Earned: 6,
    Personal: 4,
};

export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"];

/* Reason ka minimum length — Apply dialog aur server dono yehi maante hain. */
export const REASON_MIN_LENGTH = 10;

/* =========================================================================
   DATE HELPERS  (pure — components inhe `leaveShared.js` se re-export karte
   hain, taaki date logic ek hi jagah rahe)
   ========================================================================= */

/* `toISOString()` use nahi karte — woh UTC par shift karta hai aur "aaj" ke
   aas-paas ke din galat ho jaate hain. Hamesha local time. */
export const toISODate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/* Aaj ka 'YYYY-MM-DD' — date input ka `min` aur validation ke liye. */
export const todayISO = () => toISODate(new Date());

/* 'YYYY-MM-DD' parse karo local midnight par. Time component ignore hota
   hai, isliye same din ke do timestamps barabar compare hote hain. */
export const parseISODate = (value) => {
    if (!value) return null;
    const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

/* 'YYYY-MM-DD' → local midnight Date (warna `new Date('2026-01-05')` UTC
   midnight ban jata hai aur timezone shift se day badal jaata hai). */
export const toLocalDate = (value) => parseISODate(value);

/* Range ke din — 12 Oct se 14 Oct = 3, aur same din = 1.

   SAB gin-te hain, weekend bhi count hota hai. (Backend ka mirror
   `LeaveService.CountDays` se hai — dono ka formula same hona chahiye,
   warna dialog 3 din bole aur server 3 din ke bajaye kuch aur store kare.)

   Invalid range par 0. */
export const countLeaveDays = (from, to) => {
    const start = toLocalDate(from);
    const end = toLocalDate(to);
    if (!start || !end || end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
};

/* Dono ranges intersect karti hain? (touching hi kaafi hai — same day par
   do alag leave nahi ho sakte). */
export const rangesOverlap = (aFrom, aTo, bFrom, bTo) => {
    const a1 = toLocalDate(aFrom);
    const a2 = toLocalDate(aTo);
    const b1 = toLocalDate(bFrom);
    const b2 = toLocalDate(bTo);
    if (!a1 || !a2 || !b1 || !b2) return false;
    return a1 <= b2 && b1 <= a2;
};

/* 'YYYY-MM-DD' → Date, beech ke har din ke saath.
   Attendance page approved leave ke har din par 'On Leave' dikhata hai,
   aur notification message "12–14 Oct" bhi isi se banti hai. */
export const eachDate = (from, to) => {
    const start = toLocalDate(from);
    const end = toLocalDate(to);
    if (!start || !end || end < start) return [];
    const out = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        out.push(toISODate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
};

/* Type ke baaki din — `total - used`.

   `used` sirf APPROVED leaves ka hisaab hai (server waise hi gin-ta hai),
   isiliye pending request is number me nahi ginti. `balance` load nahi hua
   abhi tak null ho sakta hai — tab quota dikhate hain (loading state), 0 nahi,
   warna dialog galiat se "0 left" dikha kar bhoola deta. */
export const remainingOf = (balance, type) => {
    const row = balance?.[type];
    if (!row) return LEAVE_QUOTAS[type] ?? 0;
    return Math.max(0, (Number(row.total) || 0) - (Number(row.used) || 0));
};

/* Notification ke liye chhota range — "12–14 Oct" (same month) ya
   "28 Sep – 2 Oct" (alag month). */
export const formatRangeShort = (from, to) => {
    const a = toLocalDate(from);
    const b = toLocalDate(to);
    if (!a || !b) return "";
    const day = (d) => d.getDate();
    const mon = (d) => d.toLocaleDateString("en-IN", { month: "short" });
    if (a.getFullYear() !== b.getFullYear()) {
        return `${day(a)} ${mon(a)} ${a.getFullYear()} – ${day(b)} ${mon(b)} ${b.getFullYear()}`;
    }
    return a.getMonth() === b.getMonth()
        ? `${day(a)}–${day(b)} ${mon(a)}`
        : `${day(a)} ${mon(a)} – ${day(b)} ${mon(b)}`;
};

/* Applied-on / reviewed-on ke liye readable date-time. */
export const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/* =========================================================================
   CURRENT USER  (mock bhi yahi use karta hai)
   ========================================================================= */

export const ADMIN_ROLES = ["OWNER", "HR"];

export const readCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
};

export const isAdminRole = (role) => ADMIN_ROLES.includes(String(role || "").toUpperCase());

/* Employee page + service dono ek hi identity par kaam karein.

   `id` = Employees.Id (leave/attendance records isi par hain), jo login
   response ke `user.employeeId` me aata hai. `user.id` (Users.Id) backup ke
   liye hai — par woh ZAROORI nahi, isiliye koi `|| 1` fallback nahi: pehle
   login se pehle ka status code 1 (jo OWNER ka employee id hai) mil jata,
   aur admin data leak ho jata. Missing hone par `null` — caller handle kare. */
export const currentEmployee = () => {
    const user = readCurrentUser();
    const id = Number(user?.employeeId ?? user?.id) || null;
    const name =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "You";
    return { id, name, role: user?.role || "EMPLOYEE", user };
};

/* =========================================================================
   VALIDATION  (server bhi yehi rules lagayega — client sirf UX ke liye)
   ========================================================================= */

/* Ek hi call me saare rules. `ok: false` par `field` + `message` UI me
   jata hai.

   Ye SIRF UX ke liye hai — jaldi bata dena ki form bharne se pehle hi kya
   galat hai. Asli guard server par hai (`LeaveService.ApplyAsync`), jo har
   rule dobara check karta hai. Isliye yahan aur backend dono rules badalne
   padte hain dono taraf. */
export const validateLeaveRequest = ({ type, from, to, reason }, { balance, existingLeaves }) => {
    const days = countLeaveDays(from, to);
    const today = todayISO();

    if (!type || !LEAVE_TYPES.includes(type)) return { ok: false, field: "type", message: "Leave type is required" };
    if (!from) return { ok: false, field: "from", message: "From date is required" };
    if (!to) return { ok: false, field: "to", message: "To date is required" };
    if (from < today) return { ok: false, field: "from", message: "From date cannot be in the past" };
    if (to < today) return { ok: false, field: "to", message: "To date cannot be in the past" };
    if (to < from) return { ok: false, field: "to", message: "To date must be on or after the from date" };

    if (days <= 0) {
        return { ok: false, field: "to", message: "Select a valid date range" };
    }

    const remaining = remainingOf(balance, type);
    if (days > remaining) {
        return {
            ok: false,
            field: "days",
            message: `You have only ${remaining} ${type} day${remaining === 1 ? "" : "s"} left — this request needs ${days}`,
        };
    }

    const clash = (existingLeaves || []).find(
        (l) =>
            (l.status === "Pending" || l.status === "Approved") &&
            rangesOverlap(l.from, l.to, from, to)
    );
    if (clash) {
        return {
            ok: false,
            field: "from",
            message: `These dates clash with your ${clash.status.toLowerCase()} ${clash.type} leave (${formatRangeShort(clash.from, clash.to)})`,
        };
    }

    const reasonText = (reason || "").trim();
    if (!reasonText) return { ok: false, field: "reason", message: "Reason is required" };
    if (reasonText.length < REASON_MIN_LENGTH) {
        return {
            ok: false,
            field: "reason",
            message: `Reason must be at least ${REASON_MIN_LENGTH} characters (${reasonText.length}/${REASON_MIN_LENGTH})`,
        };
    }

    return { ok: true, days };
};

/* =========================================================================
   HTTP LAYER
   -------------------------------------------------------------------------
   Backend se aata hai, UI ko jaata hai. Beech me sirf do kaam hote hain:

     1) `toApiError`  — axios ka Error `{ message }` me badalta hai aur
        `err.field` lagata hai, taaki dialog us field ke neeche error dikha
        sake. Field guess message se hota hai (jaise "Reason must be…" →
        `reason`); na mile to `null`, aur dialog upar Snackbar dikha deta hai.

     2) `normalizeLeave` / `normalizeBalance` — server ke column names
        (`LeaveType`, `StartDate`) ko UI ke short names (`type`, `from`) me
        badalta hai. Ye mapping ek hi jagah hai, isiliye backend ka field
        naam badle to sirf yahan badalna padta hai.

   Server `from`/`to` ko 'YYYY-MM-DD' string bhejta hai (DateTime nahi) —
   isiliye yahan parse karke dobara format nahi karna, warna timezone shift
   ho jaata hai.
   ========================================================================= */

/* Axios error → UI-friendly Error. */
const toApiError = (error, fallback = "Something went wrong. Please try again.") => {
    const message =
        error?.response?.data?.message ||
        error?.response?.data?.title ||
        error?.message ||
        fallback;

    const err = new Error(message);
    err.status = error?.response?.status ?? 0;

    /* Server ke message se field guess karo — dialog us field par focus/
       highlight kar sakta hai. Order matters: "to date" ko "from" se pehle
       check karna zaroori hai, warna dono me se galat pick ho jayega. */
    const m = String(message).toLowerCase();
    if (m.includes("reason")) err.field = "reason";
    else if (m.includes("to date") || m.includes("end date")) err.field = "to";
    else if (m.includes("from date") || m.includes("start date") || m.includes("date range")) err.field = "from";
    else if (m.includes("type")) err.field = "type";
    else if (m.includes("day") || m.includes("left")) err.field = "days";

    return err;
};

/* Server ke PascalCase columns → UI ke short keys. Missing fields safe
   default milte hain, taaki ek null bhi poore row ko undefined na kar de. */
const normalizeLeave = (raw) => {
    if (!raw) return null;
    return {
        id: raw.id,
        employeeId: raw.employeeId,
        employeeName: raw.employeeName || "",
        type: raw.type,
        from: raw.from,
        to: raw.to,
        days: Number(raw.days) || 0,
        reason: raw.reason ?? "",
        status: raw.status,
        appliedOn: raw.appliedOn,
        reviewedBy: raw.reviewedBy ?? null,
        reviewedOn: raw.reviewedOn ?? null,
        adminComment: raw.adminComment ?? null,

        /* Drawer me profile chip ke liye — optional, admin list me hota hai. */
        employeeCode: raw.employeeCode ?? null,
        departmentName: raw.departmentName ?? null,
        designationTitle: raw.designationTitle ?? null,
    };
};

const normalizeBalance = (raw) => {
    const balance = {};
    for (const type of LEAVE_TYPES) {
        const row = raw?.balance?.[type];
        balance[type] = {
            total: Number(row?.total ?? LEAVE_QUOTAS[type] ?? 0),
            used: Number(row?.used ?? 0),
        };
    }
    return balance;
};

/* Applied-on naya pehle; same timestamp par id se stable order. */
const sortByAppliedDesc = (a, b) => {
    const diff = new Date(b.appliedOn) - new Date(a.appliedOn);
    return diff !== 0 ? diff : b.id - a.id;
};

/* =========================================================================
   PUBLIC SURFACE  (components + context sirf yahi use karte hain)
   ========================================================================= */

const leaveService = {
    /* GET /api/leaves/balance → { Casual:{total,used}, ... } */
    async getBalance() {
        try {
            const { data } = await http.get("/api/leaves/balance");
            return normalizeBalance(data);
        } catch (e) {
            throw toApiError(e, "Could not load your leave balance.");
        }
    },

    /* GET /api/leaves/my → [ leave ]  (naye + pending sabse upar) */
    async getMyLeaves() {
        try {
            const { data } = await http.get("/api/leaves/my");
            return (data || []).map(normalizeLeave).sort(sortByAppliedDesc);
        } catch (e) {
            throw toApiError(e, "Could not load your leave requests.");
        }
    },

    /* GET /api/leaves?status&search&type&from&to
       Admin: poori list + counts. Employee: apni hi list (server khud scope
       karta hai). Dono shape ek jaisi rakhte hain — `items` array. */
    async getAllLeaves(filters = {}) {
        try {
            const { data } = await http.get("/api/leaves", { params: filters });

            /* Server `{ items, total, ... }` bhejta hai. Agar kabhi raw
               array aa gayi to bhi tolerate kar lete hain. */
            const items = Array.isArray(data) ? data : data?.items || [];
            return items.map(normalizeLeave).sort(sortByAppliedDesc);
        } catch (e) {
            throw toApiError(e, "Could not load leave requests.");
        }
    },

    /* POST /api/leaves — `employeeId` body me nahi jaata, server token se
       nikalta hai. `days` bhi server hi calculate karta hai (client ka
       sirf UI dikhane ke liye hai). */
    async applyLeave(payload) {
        try {
            const { data } = await http.post("/api/leaves", {
                type: payload.type,
                from: payload.from,
                to: payload.to,
                reason: payload.reason,
            });
            return normalizeLeave(data);
        } catch (e) {
            throw toApiError(e, "Could not apply for leave.");
        }
    },

    /* PATCH /api/leaves/:id/cancel — sirf apna aur sirf Pending record. */
    async cancelLeave(id) {
        try {
            const { data } = await http.patch(`/api/leaves/${id}/cancel`);
            return normalizeLeave(data);
        } catch (e) {
            throw toApiError(e, "Could not cancel this request.");
        }
    },

    /* PATCH /api/leaves/:id/approve — HR/OWNER only (server par guard).
       Yahi wo jagah hai jahan balance kat-ta hai. */
    async approveLeave(id) {
        try {
            const { data } = await http.patch(`/api/leaves/${id}/approve`);
            return normalizeLeave(data);
        } catch (e) {
            throw toApiError(e, "Could not approve this request.");
        }
    },

    /* PATCH /api/leaves/:id/reject — comment mandatory. */
    async rejectLeave(id, comment) {
        try {
            const { data } = await http.patch(`/api/leaves/${id}/reject`, { comment });
            return normalizeLeave(data);
        } catch (e) {
            throw toApiError(e, "Could not reject this request.");
        }
    },

    /* Drawer ke liye ek employee ki poori history. */
    async getEmployeeLeaves(employeeId) {
        try {
            const { data } = await http.get("/api/leaves", { params: { employeeId } });
            const items = Array.isArray(data) ? data : data?.items || [];
            return items.map(normalizeLeave).sort(sortByAppliedDesc);
        } catch (e) {
            throw toApiError(e, "Could not load this employee's leave history.");
        }
    },

    /* Drawer me us employee ka current balance. */
    async getEmployeeBalance(employeeId) {
        try {
            const { data } = await http.get("/api/leaves", { params: { employeeId } });
            const items = Array.isArray(data) ? data : data?.items || [];
            /* Employee ke approved days nikal kar quota se minus karte hain.
               (`/api/leaves/balance` sirf apne liye hai — doosre ka balance
               expose karna data leak hoga.) */
            const used = {};
            for (const type of LEAVE_TYPES) used[type] = 0;
            for (const leave of items) {
                if (leave.status !== "Approved") continue;
                if (used[leave.type] === undefined) continue;
                used[leave.type] += Number(leave.days) || 0;
            }
            const balance = {};
            for (const type of LEAVE_TYPES) {
                balance[type] = { total: LEAVE_QUOTAS[type] ?? 0, used: used[type] };
            }
            return balance;
        } catch (e) {
            throw toApiError(e, "Could not load this employee's balance.");
        }
    },

    /* Notifications is surface par nahi hain — backend unhe apply/approve/
       reject par banata hai aur `NotificationBell` `GET /api/Notifications`
       se laata hai. Yahan doosri list rakhne se wahi rows double dikhti. */
};

export default leaveService;

