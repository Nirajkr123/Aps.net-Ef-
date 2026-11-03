export const STANDARD_HOURS = 8;
export const HALF_DAY_HOURS = 6;
export const HISTORY_DAYS = 180;

const pad = (value) => String(value).padStart(2, "0");

export const dayKey = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const monthLabel = (value) => (
    new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric" })
);

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
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

export const formatShortDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
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
