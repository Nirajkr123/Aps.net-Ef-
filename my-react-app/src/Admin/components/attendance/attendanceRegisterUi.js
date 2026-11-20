const CODE_META = {
    P: { label: "Present", short: "P", tone: "present" },
    LT: { label: "Late", short: "LT", tone: "late" },
    HD: { label: "Half day", short: "HD", tone: "half-day" },
    A: { label: "Absent", short: "A", tone: "absent" },
    L: { label: "Paid leave", short: "L", tone: "leave" },
    UL: { label: "Unpaid leave", short: "UL", tone: "unpaid" },
    H: { label: "Holiday", short: "H", tone: "holiday" },
    WO: { label: "Week off", short: "WO", tone: "week-off" },
    PENDING: { label: "Pending", short: "•", tone: "pending" },
    "-": { label: "Not applicable", short: "–", tone: "dash" },
};

const FLAG_LABELS = {
    LATE: "Late",
    MISSING_CHECKOUT: "Missing checkout",
    OPEN_SHIFT: "Open shift",
    NO_PUNCH: "No punch",
    HALF_DAY_LEAVE: "Half-day leave",
    UNPAID_LEAVE: "Unpaid leave",
    PAID_LEAVE: "Paid leave",
    WORKED_ON_LEAVE: "Worked on leave",
    WORKED_ON_OFF: "Worked on off day",
    MULTI_SHIFT: "Multi shift",
    PARTIAL_MULTI_SHIFT: "Partial multi-shift",
    SANDWICH_LOP: "Sandwich LOP",
    FUTURE: "Future date",
    BEFORE_JOINING: "Before joining",
    AFTER_EXIT: "After exit",
    EXIT_DATE_ESTIMATED: "Exit date estimated",
    MANUAL_OVERRIDE: "Manual override",
    LEGACY_LEAVE: "Legacy leave",
    STATUS_CONFLICT: "Status conflict",
};

export const getCodeMeta = (code) =>
    CODE_META[String(code || "-").toUpperCase()] || {
        label: code || "Not applicable",
        short: code || "–",
        tone: "dash",
    };

export const flagLabel = (flag) =>
    FLAG_LABELS[String(flag || "").toUpperCase()] ||
    String(flag || "")
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const initialsOf = (name) =>
    (name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");

export const formatDays = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
};

export const formatRegisterHours = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "0h";
    const whole = Math.floor(number);
    const minutes = Math.round((number - whole) * 60);
    if (minutes === 60) return `${whole + 1}h`;
    if (minutes === 0) return `${whole}h`;
    return `${whole}h ${minutes}m`;
};

export const weekdayShort = (date) => {
    if (!date) return "";
    const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("en-IN", { weekday: "short" });
};

export const formatMonthLabel = (month) => {
    if (!month) return "";
    const parsed = new Date(`${month}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return month;
    return parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

export const formatRegisterTimestamp = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const dayTooltip = (day) => {
    if (!day) return "";
    const parts = [getCodeMeta(day.code).label];

    if (day.leave) {
        parts.push(
            `${day.leave.type}${day.leave.isPaid ? "" : " (unpaid)"} · ${day.leave.status}`
        );
    }
    if (day.holiday?.name) parts.push(day.holiday.name);
    if (Number(day.workingHours) > 0) {
        parts.push(`${formatRegisterHours(day.workingHours)} worked`);
    }
    if (Array.isArray(day.flags) && day.flags.length > 0) {
        parts.push(day.flags.map(flagLabel).join(", "));
    }

    return parts.filter(Boolean).join(" · ");
};

export const buildDownloadName = (month) =>
    `attendance-register-${month || "month"}.csv`;
