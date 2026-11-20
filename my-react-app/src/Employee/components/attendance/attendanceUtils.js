export const STANDARD_HOURS = 8;
export const HALF_DAY_HOURS = 6;
export const HISTORY_DAYS = 180;

export const WINDOW_STATES = Object.freeze({
    NO_SHIFT: "NO_SHIFT",
    BEFORE_WINDOW: "BEFORE_WINDOW",
    OPEN: "OPEN",
    CHECK_IN_CLOSED: "CHECK_IN_CLOSED",
    CLOSED: "CLOSED",
});

const pad = (value) => String(value).padStart(2, "0");
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "string") {
        const match = value.match(DATE_ONLY);
        if (match) {
            const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            return Number.isNaN(date.getTime()) ? null : date;
        }
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const dayKey = (value) => {
    const date = parseDate(value);
    if (!date) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const monthLabel = (value) => {
    const date = parseDate(value);
    return date ? date.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "-";
};

export const monthRange = (value) => {
    const date = new Date(value);
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: dayKey(from), to: dayKey(to) };
};

export const isSameMonth = (left, right) => {
    const a = new Date(left);
    const b = new Date(right);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
};

export const formatTime = (value) => {
    if (!value) return "--:--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
};

export const formatFullDate = (value) => {
    const date = parseDate(value);
    if (!date) return "-";
    return date.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

export const formatShortDate = (value) => {
    const date = parseDate(value);
    if (!date) return "-";
    return date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

export const formatDuration = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const formatHours = (hours) => {
    const value = Number(hours);
    if (!Number.isFinite(value) || value <= 0) return "--";
    const whole = Math.floor(value);
    const minutes = Math.round((value - whole) * 60);
    if (minutes === 60) return `${whole + 1}h`;
    if (minutes === 0) return `${whole}h`;
    return `${whole}h ${minutes}m`;
};

const timestamp = (value) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
};

export const formatShiftLabel = (shift) => {
    if (!shift) return "";
    const times = `${formatTime(shift.startAt)} – ${formatTime(shift.endAt)}`;
    return `${shift.shiftName || "Shift"} · ${times}${shift.crossesMidnight ? " (next day)" : ""}`;
};

export const resolveTodayWindow = (state, now = new Date()) => {
    const empty = {
        windowState: null,
        hasCheckIn: false,
        hasCheckOut: false,
        canCheckIn: false,
        canCheckOut: false,
        checkInEnabled: false,
        checkOutEnabled: false,
        punchEnabled: false,
        shiftLabel: "",
        windowSummary: "",
        windowNote: "",
        isWarning: false,
    };

    if (!state) return empty;

    const shift = state.shift || null;
    const attendance = state.attendance || null;
    const hasCheckIn = Boolean(attendance?.checkInTime);
    const hasCheckOut = Boolean(attendance?.checkOutTime);
    const mode = String(state.enforcementMode || "WARN").trim().toUpperCase();
    const enforce = mode === "ENFORCE";
    const nowMs = new Date(now).getTime();
    const opens = timestamp(state.windowOpensAt);
    const deadline = timestamp(state.checkInDeadlineAt);
    const closes = timestamp(state.windowClosesAt);

    let windowState = state.windowState || WINDOW_STATES.NO_SHIFT;
    if (shift) {
        if (opens !== null && nowMs < opens) windowState = WINDOW_STATES.BEFORE_WINDOW;
        else if (closes !== null && nowMs > closes) windowState = WINDOW_STATES.CLOSED;
        else if (deadline !== null && nowMs > deadline) windowState = WINDOW_STATES.CHECK_IN_CLOSED;
        else windowState = WINDOW_STATES.OPEN;
    } else {
        windowState = WINDOW_STATES.NO_SHIFT;
    }

    const withinCheckIn = opens !== null && deadline !== null
        && nowMs >= opens && nowMs <= deadline;
    const withinCheckOut = closes !== null && nowMs <= closes;

    const canCheckIn = !hasCheckIn && !hasCheckOut && (
        opens !== null && deadline !== null
            ? withinCheckIn
            : Boolean(state.canCheckIn)
    );
    const canCheckOut = hasCheckIn && !hasCheckOut && (
        closes !== null
            ? withinCheckOut
            : Boolean(state.canCheckOut)
    );

    const checkInEnabled = !hasCheckIn && !hasCheckOut && (
        shift ? (enforce ? canCheckIn : true) : canCheckIn
    );
    const checkOutEnabled = hasCheckIn && !hasCheckOut && (
        shift ? (enforce ? canCheckOut : true) : canCheckOut
    );

    const isWarning = mode === "WARN" && (
        (checkInEnabled && !canCheckIn) || (checkOutEnabled && !canCheckOut)
    );

    let windowSummary = "";
    let target = null;

    if (hasCheckOut) {
        windowSummary = "Attendance complete";
    } else if (windowState === WINDOW_STATES.NO_SHIFT) {
        windowSummary = "No shift assigned";
    } else if (windowState === WINDOW_STATES.BEFORE_WINDOW) {
        target = opens;
        windowSummary = `Check-in opens in ${formatDuration((target ?? nowMs) - nowMs)}`;
    } else if (windowState === WINDOW_STATES.OPEN) {
        target = hasCheckIn ? closes : deadline;
        windowSummary = hasCheckIn
            ? `Check-out window closes in ${formatDuration((target ?? nowMs) - nowMs)}`
            : `Check-in closes in ${formatDuration((target ?? nowMs) - nowMs)}`;
    } else if (windowState === WINDOW_STATES.CHECK_IN_CLOSED) {
        target = closes;
        windowSummary = `Check-out closes in ${formatDuration((target ?? nowMs) - nowMs)}`;
    } else {
        windowSummary = "Shift window closed";
    }

    let windowNote = "";
    if (hasCheckOut) {
        windowNote = "";
    } else if (windowState === WINDOW_STATES.NO_SHIFT) {
        windowNote = "No shift is assigned for this attendance date.";
    } else if (windowState === WINDOW_STATES.BEFORE_WINDOW) {
        windowNote = `Check-in opens at ${formatTime(state.windowOpensAt)}.`;
    } else if (windowState === WINDOW_STATES.OPEN) {
        windowNote = hasCheckIn
            ? `Check-out is open until ${formatTime(state.windowClosesAt)}.`
            : `Check-in is open until ${formatTime(state.checkInDeadlineAt)}.`;
    } else if (windowState === WINDOW_STATES.CHECK_IN_CLOSED) {
        windowNote = `Check-in closed at ${formatTime(state.checkInDeadlineAt)}. Check-out is open until ${formatTime(state.windowClosesAt)}.`;
    } else {
        windowNote = `The shift window closed at ${formatTime(state.windowClosesAt)}.`;
    }

    if (isWarning) {
        windowNote = `${windowNote} This punch will be recorded with a warning.`;
    }

    return {
        windowState,
        hasCheckIn,
        hasCheckOut,
        canCheckIn,
        canCheckOut,
        checkInEnabled,
        checkOutEnabled,
        punchEnabled: hasCheckIn ? checkOutEnabled : checkInEnabled,
        shiftLabel: formatShiftLabel(shift),
        windowSummary,
        windowNote,
        isWarning,
    };
};

export const normalizeRow = (row) => (
    row
        ? {
            ...row,
            date: row.date || row.attendanceDate || row.AttendanceDate || null,
        }
        : null
);

export const unwrapList = (response) => {
    const data = response?.data !== undefined ? response.data : response;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

export const unwrapOne = (response) => {
    const data = response?.data !== undefined ? response.data : response;
    if (data && typeof data === "object" && !Array.isArray(data) && data.data && typeof data.data === "object") {
        return data.data;
    }
    return data ?? null;
};

export const rowHours = (row) => {
    if (!row) return 0;
    if (row.checkInTime && row.checkOutTime) {
        const diff = (new Date(row.checkOutTime) - new Date(row.checkInTime)) / 3600000;
        if (Number.isFinite(diff) && diff > 0) return diff;
    }
    const saved = Number(row.workingHours);
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
};

export const liveHours = (row) => {
    if (!row?.checkInTime) return 0;
    const end = row.checkOutTime ? new Date(row.checkOutTime) : new Date();
    const diff = (end - new Date(row.checkInTime)) / 3600000;
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
};

export const rowStatus = (row) => {
    if (!row) return "No record";

    const status = String(row.status || "").trim().toLowerCase();
    const isHalfDay = status === "half-day" || status === "half day" || status === "halfday";
    const savedStatus = status === "absent"
        ? "Absent"
        : status === "leave"
            ? "Leave"
            : isHalfDay
                ? "Half-day"
                : "";

    if (row.checkInTime && row.checkOutTime) {
        if (savedStatus) return savedStatus;
        if (row.isLate === true || status === "late") return "Late";

        const hours = rowHours(row);
        if (hours > 0) return hours < HALF_DAY_HOURS ? "Half-day" : "Present";
        return "No record";
    }

    if (row.checkInTime) return row.isToday ? "In progress" : "No checkout";
    return savedStatus || "No record";
};

export const sortRowsDesc = (rows) => (
    [...rows].sort((left, right) => new Date(right.date) - new Date(left.date))
);

export const historyRange = () => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - HISTORY_DAYS);
    return { from: dayKey(from), to: dayKey(now) };
};
