import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Alert, Box, Button, Card, CardContent, Chip, Grid, IconButton,
    LinearProgress, Skeleton, Table, TableBody, TableCell, TableContainer,
    TableHead, TablePagination, TableRow, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import {
    AccessTimeOutlined, BadgeOutlined, BarChartOutlined, BeachAccessOutlined,
    CalendarMonthOutlined, CalendarTodayOutlined, CancelOutlined,
    CheckCircleOutlined, EventBusyOutlined, EventOutlined,
    ExpandMoreRounded, InsightsOutlined, PaymentsOutlined, PersonOutlined,
    RemoveCircleOutlined, ScheduleOutlined, WarningAmberOutlined,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";
import "./EmployeeAttendance.css";

import attendanceServ from "../services/attendanceService";



/* Shared attendance constants + helpers.
   Ye sab helpers page se nikaal kar ek jagah rakhe hain, kyunki ab
   5 alag components inhe use karte hain — status ka colour, ghante
   ka calculation aur time formatting EK hi jagah se aani chahiye,
   warna table / chart / cards alag alag value dikha dete hain. */

/* Din ka standard working hours — overtime isi se nikalta hai. */
const STANDARD_HOURS = 8;

/* 6 ghante se kam = Half Day (table + chart dono ka rule) */
const HALF_DAY_HOURS = 6;

/* 1 din = 1 row. Counted rows par hi %/average lagte hain, taaki
   future/empty days percentage ko dilute na karein. */
const CHART_DAYS = 7;

/* Weekly bar graph me kitne weeks — pichle 11 + yeh current week.
   12 weeks ≈ 3 mahine, jo "Last 6 months" summary ke trend ko
   bina chart bhari banaye dikhata hai. */
const WEEK_COUNT = 12;

/* Weekly graph ka plot height (px). BAR ka percentage height apne
   immediate parent ke against resolve hota hai, isliye ye definite
   hona zaroori hai — parent auto-height hua to `%` bhi auto (0) ho
   jata tha aur saare bars invisible dikhte the. Isi wajah se
   `AttendanceBarChart` me bhi `PLOT_HEIGHT` ki same zaroorat hai. */
const WEEK_PLOT_H = 190;

/* Week ki shuruaat — Monday, local midnight. Chart ke har bar ka
   yeh ek calendar week (Mon→Sun) hota hai, isliye rolling 7-day
   window nahi balki asli week bucketing chahiye. */
const weekStartOf = (d) => {
    const x = new Date(d);
    /* getDay(): 0 = Sunday. Monday ko 0 banana hai, isliye +6 kar ke
       modulo 7 lete hain (Sunday 0 → 6, Monday 1 → 0). */
    const shift = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - shift);
    x.setHours(0, 0, 0, 0);
    return x;
};

/* Ek page me kitne rows.
   Mobile (chhoti screen) par 5 — cards lambe hote hain (In/Out, Hours,
   Timing, Status) to 5 hi ek screen me aaram se aa jaate hain.
   Desktop par 10 — table rows patli hain to 10 ek screen me aa jaate hain.
   `COMPACT_BP` `EmployeeAttendance.css` ke `@media (max-width: 700px)`
   se match karta hai — wahi breakpoint jahan table band hokar
   stacked cards shuru hote hain. */
const COMPACT_BP = "(max-width: 700px)";
const ROWS_PER_PAGE_MOBILE = 5;
const ROWS_PER_PAGE_DESKTOP = 10;

/* TablePagination ka dropdown — mobile par sirf 5/10 (chhoti screen
   par 25/50/100 select karna khud hi aap ko bahut lamba list dega),
   desktop par 10/25/50/100. */
const ROWS_OPTIONS_COMPACT = [ROWS_PER_PAGE_MOBILE, ROWS_PER_PAGE_DESKTOP];
const ROWS_OPTIONS_WIDE = [ROWS_PER_PAGE_DESKTOP, 25, 50, 100];

/* Desktop par list ki max height — 10 rows + sticky header ke baad.
   `overscroll-behavior: contain` zaroori hai — warna list ke bottom tak
   pahunchte hi poora page bhi scroll ho jaata ("scroll chaining"),
   jo rokna yahi hai. Mobile wali height (`68vh`) CSS me hai, kyunki
   wahan list `.emp-att-cards` se render hoti hai. */
const LIST_MAX_H_WIDE = 520;

/* Table me default kitne punch days — "load more" dabane par poore
   month ke records. */
const PUNCH_DAYS = 14;

/* History fetch range: 6 mahine peeche se aaj tak.
   Pehle sirf current month fetch hota tha — isliye jiske records
   pichle mahine ke the, uski poori history blank aa jati thi. */
const HISTORY_DAYS = 180;

/* Shift timings — "Shift" field aur timeline axis dono isi par chalti hain. */
const SHIFT_LABEL = "9 AM – 6 PM";

/* ---- Colour tokens ----
   Ek hi mapping poori page par: green = present, red = absent,
   orange = late, blue = on leave. Cards, chart aur status chips
   teenon isi table se colour lete hain. */
const ATTENDANCE_COLORS = {
    Present: { main: "#059669", soft: "#ecfdf5", border: "#a7f3d0" },
    Absent: { main: "#dc2626", soft: "#fef2f2", border: "#fecaca" },
    Late: { main: "#d97706", soft: "#fffbeb", border: "#fde68a" },
    Leave: { main: "#2563eb", soft: "#eff6ff", border: "#bfdbfe" },
    "Half-day": { main: "#ea580c", soft: "#fff7ed", border: "#fed7aa" },
    "In progress": { main: "#4338ca", soft: "#eef2ff", border: "#c7d2fe" },
    "No checkout": { main: "#b45309", soft: "#fffbeb", border: "#fde68a" },
    "No record": { main: "#94a3b8", soft: "#f8fafc", border: "#eef2f7" },
    Weekend: { main: "#a8b3c4", soft: "#fbfcfe", border: "#f1f5f9" },
};

/* Status → badge ka colour + icon. Pehle MUI `color` prop use ho
   raha tha, jisme "Half-day" aur "Late" dono `warning` (same
   yellow) ban jaate the — isliye ab explicit map hai:
   Present=green, Absent=red, Half Day=orange, Late=yellow. */
const STATUS_META = {
    Present: { label: "Present", fg: "#047857", bg: "#ecfdf5", border: "#a7f3d0", icon: CheckCircleOutlined },
    Absent: { label: "Absent", fg: "#b91c1c", bg: "#fef2f2", border: "#fecaca", icon: CancelOutlined },
    "Half-day": { label: "Half Day", fg: "#c2410c", bg: "#fff7ed", border: "#fed7aa", icon: ScheduleOutlined },
    HalfDay: { label: "Half Day", fg: "#c2410c", bg: "#fff7ed", border: "#fed7aa", icon: ScheduleOutlined },
    Late: { label: "Late", fg: "#a16207", bg: "#fefce8", border: "#fde047", icon: WarningAmberOutlined },
    Leave: { label: "Leave", fg: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", icon: BeachAccessOutlined },
    /* Sirf check-in hai, checkout nahi — aaj ke liye "In progress",
       purane record ke liye "No checkout" (galat punch data). */
    "In progress": { label: "In progress", fg: "#4338ca", bg: "#eef2ff", border: "#c7d2fe", icon: ScheduleOutlined },
    "No checkout": { label: "No checkout", fg: "#b45309", bg: "#fffbeb", border: "#fde68a", icon: WarningAmberOutlined },
    /* Calendar densification ke liye 2 extra "status" — record hi nahi
       bana, aur Sunday. Inke koi icon nahi chahiye. */
    "No record": { label: "No record", fg: "#94a3b8", bg: "#f8fafc", border: "#eef2f7", icon: RemoveCircleOutlined },
    Weekend: { label: "Weekend", fg: "#a8b3c4", bg: "#fbfcfe", border: "#f1f5f9", icon: CalendarTodayOutlined },
};

const statusMeta = (status) =>
    STATUS_META[status] || { label: status || "—", fg: "#4b5563", bg: "#f3f4f6", border: "#e5e7eb", icon: InsightsOutlined };

/* Status Chip ka MUI `color` prop. Table me seedha `sx={{ color: fg,
   background: bg }}` lagana padta tha, kyunki MUI ka `warning` aur
   `Half-day` ke orange ko represent nahi kar pata. Ye map Chip ko
   standard palette deta hai, badge styling alag se. */
const STATUS_CHIP_COLOR = {
    Present: "success",
    "Half-day": "warning",
    HalfDay: "warning",
    Late: "warning",
    Absent: "error",
    Leave: "info",
    "In progress": "info",
    "No checkout": "warning",
    "No record": "default",
    Weekend: "default",
};

/* Calendar row ka status label — TABLE, CHART aur STAT CARDS teeno yahi
   use karte hain, isliye teeno ki value kabhi alag nahi dikhti.

   Rule:
     · Check In + Check Out dono → pehle `isLate` check (late + 8h ka
       din warna "Present" ho jata tha, jisse Late card ka count table se
       match hi nahi karta tha), phir ghante 6 se kam = "Half-day",
       warna "Present"
     · sirf Check In              → aaj = "In progress", purana = "No checkout"
     · koi punch nahi             → "No record" (ya DB ka Absent/Leave)

   Naam "Half-day" (hyphen) hai — `ATTENDANCE_COLORS`, `STATUS_META`,
   `WEEK_TONE` sab yahi key use karte hain. Pehle ye "HalfDay" deta tha,
   to lookup undefined milta aur chip grey/default dikhta. */
const rowStatus = (row) => {
    if (!row) return "No record";
    if (row.checkInTime && row.checkOutTime) {
        const h = rowHours(row);
        if (h > 0) {
            if (row.isLate === true || row.status === "Late") return "Late";
            return h < HALF_DAY_HOURS ? "Half-day" : "Present";
        }
        return "No record";
    }
    if (row.checkInTime) return row.isToday ? "In progress" : "No checkout";
    if (row.status === "Absent" || row.status === "Leave") return row.status;
    return "No record";
};

/* Backend model me property "AttendanceDate" hai, isliye JSON me
   "attendanceDate" aata hai — par page me "date" use hota hai.
   Isliye ek hi jagah normalize kar dete hain, warna Date column
   blank aa jata hai. */
const normalizeRow = (r) =>
    r ? { ...r, date: r.date || r.attendanceDate || r.AttendanceDate || null } : null;

/* Ghante (number) — HAMESHA check-out − check-in se nikalte hain.
   Backend ka `workingHours` sirf tab use hota hai jab dono times
   na mile (old rows). Isse "In/Out dono times diye hain par Hours
   me '—'" wala bug khatam ho gaya. */
const rowHours = (r) => {
    if (!r) return 0;
    if (r.checkInTime && r.checkOutTime) {
        const diff = (new Date(r.checkOutTime) - new Date(r.checkInTime)) / 3600000;
        if (Number.isFinite(diff) && diff > 0) return diff;
    }
    const saved = Number(r.workingHours);
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
};

const BAR_COLOR = {
    Present: "linear-gradient(180deg, #34d399 0%, #059669 100%)",
    "Half-day": "linear-gradient(180deg, #fdba74 0%, #ea580c 100%)",
    HalfDay: "linear-gradient(180deg, #fdba74 0%, #ea580c 100%)",
    Absent: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)",
    Late: "linear-gradient(180deg, #fde047 0%, #ca8a04 100%)",
    Leave: "linear-gradient(180deg, #93c5fd 0%, #2563eb 100%)",
};

const barColor = (status, hours) =>
    hours > 0 ? (BAR_COLOR[status] || BAR_COLOR.Present) : "#e5e7eb";

/* `YYYY-MM-DD` — local time ke hisaab se (toISOString UTC shift
   karta hai aur records galat day par match ho jaate hain). */
const dayKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Us din koi punch hua tha ya nahi — streak/avg ke liye. */
const workedDay = (r) => !!r && r.status !== "Absent" && r.status !== "Leave" && rowHours(r) > 0;

/* `http` full axios response return karta hai (res.data pe nahi), par
   kuch jagah service direct data de deti hai — isliye dono shape
   handle karne wala helper. Iske bina `.map` pe crash hota tha. */
const unwrap = (res) => {
    const d = res?.data !== undefined ? res.data : res;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    return [];
};

/* Single object (leave balance, aaj ka record) ke liye same unwrap. */
const unwrapOne = (res) => {
    const d = res?.data !== undefined ? res.data : res;
    if (d && typeof d === "object" && !Array.isArray(d) && d.data && typeof d.data === "object") {
        return d.data;
    }
    return d ?? null;
};

const historyRange = () => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - HISTORY_DAYS);
    return { from: dayKey(from), to: dayKey(now) };
};

/* ---- Timing bar (har table row + mobile card) ----
   Din ka 6 AM → 10 PM window axis banata hai, aur har record ki
   check-in se check-out tak ki duration ek segment ban jaati hai.
   Isse "kitne ghante" ke saath "KAB" bhi pata chal jaata hai. */
const TL_START_HOUR = 6;
const TL_END_HOUR = 22;
const TL_SPAN = TL_END_HOUR - TL_START_HOUR;

const hourOfDay = (t) => {
    const d = new Date(t);
    return d.getHours() + d.getMinutes() / 60;
};

const clampHour = (h) => Math.min(Math.max(h, TL_START_HOUR), TL_END_HOUR);

/* 0 → left edge, 100 → right edge */
const pctOfDay = (t) => ((clampHour(hourOfDay(t)) - TL_START_HOUR) / TL_SPAN) * 100;

/* ---- Per-row timing bar (table + mobile cards) ----
   6 AM → 10 PM window me check-in se check-out tak ka segment.
   · aaj ka khula record → "ab tak" ka segment + live tone
   · purana khula record → shift-end tak + amber "No checkout" tone
   Colour status se aata hai, isliye table ka bar aur status badge
   hamesha ek hi baat kehte hain. */
const rowTiming = (row) => {
    const inPct = pctOfDay(row.checkInTime);
    const open = !row.checkOutTime;
    const outPct = open
        ? (row.isToday ? pctOfDay(new Date()) : 100)
        : pctOfDay(row.checkOutTime);
    const st = rowStatus(row);
    const tone = st === "HalfDay" || st === "Half-day"
        ? "half"
        : st === "In progress"
            ? "open"
            : st === "No checkout"
                ? "stale"
                : "on";
    return { inPct, outPct, width: Math.max(outPct - inPct, 1.5), tone };
};

/* ---- Formatting ----
   Ye teen helper pehle page ke andar the, par ab 4 components
   (punch card + history table + mobile cards) inhe use karte hain. */
const formatTime = (t) => {
    if (!t) return "--:--";
    return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/* "7h 30m" — dono times mile to hi, warna em-dash. */
const workHours = (inTime, outTime) => {
    if (!inTime || !outTime) return "—";
    const diff = new Date(outTime) - new Date(inTime);
    if (diff < 0) return "—";
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
};

/* Aaj ke ghante (number) — "Hours Today" progress bar ke liye.
   Check-out nahi hua to abhi tak ka time hi count hota hai. */
const liveHours = (record) => {
    const inTime = record?.checkInTime;
    if (!inTime) return 0;
    const end = record?.checkOutTime ? new Date(record.checkOutTime) : new Date();
    const hrs = (end - new Date(inTime)) / 3600000;
    return Number.isFinite(hrs) && hrs > 0 ? hrs : 0;
};

/* Page ka title block — "My Attendance" + current month + Demo data chip.
   Hero wrapper (`.emp-hero`) CSS se aata hai, isliye wo class yahan
   rakha gaya hai; andar ka layout `sx` se, taaki card ke baaki hisse
   ke saath ek hi styling language rahe.

   NOTE: Ye page abhi bhi apna original header use karta hai — ise
   `PageHeroBanner` par migrate nahi kiya gaya, kyunki yahan ka look
   bilkul waisa hi rakhna hai. Shared banner sirf "My Leaves" par hai. */
function AttendanceHeader({ monthLabel, scopeLabel, isDemo = true }) {
    return (
        <Box className="emp-hero" sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "#171b2e", lineHeight: 1.25 }}>
                        My Attendance
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Mark your attendance and view history
                    </Typography>
                </Box>

               
            </Box>
        </Box>
    );
}

/* Aaj ka punch card — status headline, In/Out times, working hours,
   shift aur full-width Check In / Check Out button.

   Card ke andar ka `FlatField` ek chhota local component hai: label
   upar, value neeche. Grid ke 4 fields (In / Out / Hours / Shift) me
   same markup repeat na ho isliye alag nikaala gaya hai. */
function FlatField({ label, value, loading, tone = "default" }) {
    return (
        <Box
            sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "grey.50",
                px: 1,
                py: 0.6,
                minWidth: 0,
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    display: "block",
                    fontWeight: 700,
                    letterSpacing: ".4px",
                    textTransform: "uppercase",
                    color: "text.disabled",
                    fontSize: 10.5,
                }}
            >
                {label}
            </Typography>
            {loading ? (
                <Skeleton width={64} height={22} />
            ) : (
                <Typography
                    sx={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: tone === "muted" ? "text.disabled" : "text.primary",
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.25,
                    }}
                >
                    {value}
                </Typography>
            )}
        </Box>
    );
}

/* Punch state → headline text + chip colour. Teen hi states hain,
   isliye ek jagah map kiya hai — button, headline aur chip hamesha
   ek hi baat bolte hain. */
const PUNCH_STATE = {
    none: { headline: "Not Checked In", chip: "Pending", chipColor: "warning", Icon: ScheduleOutlined, button: "Check In" },
    open: { headline: "Checked In", chip: "In progress", chipColor: "info", Icon: AccessTimeOutlined, button: "Check Out" },
    done: { headline: "Day Complete", chip: "Completed", chipColor: "success", Icon: CheckCircleOutlined, button: "Day Complete" },
};

function TodayAttendanceCard({ todayRecord, loading, punchLoading, punchError, onPunch }) {
    const hasIn = !!todayRecord?.checkInTime;
    const hasOut = !!todayRecord?.checkOutTime;
    const state = !hasIn ? PUNCH_STATE.none : hasOut ? PUNCH_STATE.done : PUNCH_STATE.open;
    const { headline, chip, chipColor, Icon, button } = state;

    const hoursNum = liveHours(todayRecord);
    const pct = Math.min(100, Math.round((hoursNum / STANDARD_HOURS) * 100));
    const disabled = punchLoading || (hasIn && hasOut);

    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                height: "100%",
            }}
        >
            <CardContent sx={{ p: { xs: 2, md: 2.5 }, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Today&apos;s Attendance
                    </Typography>
                    <Chip label={chip} color={chipColor} size="small" sx={{ fontWeight: 700 }} />
                </Box>

                {/* ---- Punch section — apne card ke andar ----
                    Headline, In/Out/Hours/Shift fields, progress bar aur
                    punch button — ye sab ek nested card me band hain, taaki
                    "Today's Attendance" header se punch controls visually
                    alag dikhne laagein. */}
                <Card
                    elevation={0}
                    sx={{
                        borderRadius: 2.5,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "grey.50",
                    }}
                >
                    <CardContent
                        sx={{
                            p: 1.25,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.25,
                            "&:last-child": { pb: 1.25 },
                        }}
                    >
                        <Box>
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 800,
                                    lineHeight: 1.2,
                                    letterSpacing: "-.2px",
                                    color: hasIn ? "text.primary" : "text.disabled",
                                }}
                            >
                                {loading ? "Loading…" : headline}
                            </Typography>
                            {hasIn && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {hasOut
                                        ? `Punched in at ${formatTime(todayRecord.checkInTime)}`
                                        : `Punched in at ${formatTime(todayRecord.checkInTime)} — don&apos;t forget to check out`}
                                </Typography>
                            )}
                        </Box>

                        {/* 4 fields: mobile par 2+2, desktop par ek hi line
                            (4 across) — isse ek poori row ki height bachti hai
                            aur punch-section card aur chhota dikhta hai. */}
                        <Grid container spacing={1.25}>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <FlatField
                                    label="Check-In"
                                    loading={loading}
                                    value={formatTime(todayRecord?.checkInTime)}
                                    tone={hasIn ? "default" : "muted"}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <FlatField
                                    label="Check-Out"
                                    loading={loading}
                                    value={formatTime(todayRecord?.checkOutTime)}
                                    tone={hasOut ? "default" : "muted"}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <FlatField
                                    label="Working Hours"
                                    loading={loading}
                                    value={loading ? "" : workHours(todayRecord?.checkInTime, todayRecord?.checkOutTime)}
                                    tone={hoursNum > 0 ? "default" : "muted"}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <FlatField label="Shift" value={SHIFT_LABEL} />
                            </Grid>
                        </Grid>

                        {hasIn && (
                            <Box>
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        Progress toward {STANDARD_HOURS}h target
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                        {pct}%
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    sx={{
                                        height: 6,
                                        borderRadius: 999,
                                        bgcolor: "grey.100",
                                        "& .MuiLinearProgress-bar": { borderRadius: 999 },
                                    }}
                                />
                            </Box>
                        )}

                        {punchError && (
                            <Alert severity="error" sx={{ borderRadius: 2, fontSize: 12.5 }}>
                                {punchError}
                            </Alert>
                        )}

                        <Box sx={{ mt: "auto" }}>
                            {hasIn && hasOut ? (
                                /* Din pura hone par button ki jagah ek green card —
                                   clickable nahi, sirf status dikhata hai. Check In /
                                   Check Out ke liye asli button neeche rehta hai. */
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: 3,
                                        bgcolor: "#047857",
                                        border: "1px solid #065f46",
                                        boxShadow: "0 6px 16px -8px rgba(4,120,87,.65)",
                                    }}
                                >
                                    <CardContent
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 1,
                                            py: 1,
                                            px: 2,
                                            "&:last-child": { pb: 1 },
                                        }}
                                    >
                                        <CheckCircleOutlined sx={{ fontSize: 20 }} />
                                        <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: "#ffffff" }}>
                                            {button}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Button
                                    variant="contained"
                                    color="success"
                                    size="large"
                                    fullWidth
                                    disabled={disabled || loading}
                                    onClick={onPunch}
                                    startIcon={<Icon sx={{ fontSize: 20 }} />}
                                    sx={{ borderRadius: 999, py: 0.75, fontWeight: 700, textTransform: "none" }}
                                >
                                    {punchLoading ? "Saving…" : button}
                                </Button>
                            )}
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", textAlign: "center", mt: 1.25 }}
                            >
                                {hasOut
                                    ? `Today's punch is recorded. Shift: ${SHIFT_LABEL}`
                                    : `One tap records today's punch. Shift: ${SHIFT_LABEL}`}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    );
}

/* 4 summary cards — Present / Absent / Late / On Leave.
   Icon + label + bold count, aur card ka accent colour UMEIN
   `ATTENDANCE_COLORS` se aata hai taaki bar chart ke bars aur
   table ke status chips ek hi palette follow karein:
   green = present, red = absent, orange = late, blue = on leave. */
const CATEGORIES = [
    { key: "Present", label: "Present", icon: CalendarMonthOutlined, tone: ATTENDANCE_COLORS.Present },
    { key: "Absent", label: "Absent", icon: EventBusyOutlined, tone: ATTENDANCE_COLORS.Absent },
    { key: "Late", label: "Late", icon: ScheduleOutlined, tone: ATTENDANCE_COLORS.Late },
    { key: "Leave", label: "On Leave", icon: BeachAccessOutlined, tone: ATTENDANCE_COLORS.Leave },
];

/* Card par click karke history table filter karne ke liye buttons.
   `Half-day` ka koi stat card nahi hai, isliye uske liye niche
   filter-chip row alag se banaya gaya hai — warna 6 ghante wale
   din kabhi reachable hi nahi hote (kisi card me bhi nahi, "All" me
   bhi sirf tab jab koi filter na ho). */
const STATUS_FILTER_KEYS = ["Present", "Half-day", "Late", "Absent", "Leave"];

function StatCard({ category, count, sub, loading, onClick, active }) {
    const { label, icon: Icon, tone } = category;
    return (
        <Card
            elevation={0}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-pressed={onClick ? !!active : undefined}
            onKeyDown={
                onClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onClick();
                        }
                    }
                    : undefined
            }
            sx={{
                borderRadius: 3,
                border: "1px solid",
                borderColor: active ? tone.main : "divider",
                height: "100%",
                cursor: onClick ? "pointer" : "default",
                transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease, background-color .22s ease",
                /* Active filter ka feedback — halka tone-tinted background
                   + 2px ring, taaki pata chale filter lag raha hai. */
                ...(active
                    ? { backgroundColor: tone.soft, boxShadow: `0 0 0 2px ${tone.border} inset` }
                    : {}),
                "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: onClick
                        ? `0 12px 26px -18px ${tone.main}`
                        : "0 12px 26px -18px rgba(15,23,42,.4)",
                },
                "&:focus-visible": { outline: `2px solid ${tone.main}`, outlineOffset: 2 },
            }}
        >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            flexShrink: 0,
                            borderRadius: 2.5,
                            color: tone.main,
                            bgcolor: tone.soft,
                            border: `1px solid ${tone.border}`,
                        }}
                    >
                        <Icon sx={{ fontSize: 20 }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {label}
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 1.5 }}>
                    {loading ? (
                        <Skeleton width={72} height={38} />
                    ) : (
                        <Typography
                            variant="h5"
                            sx={{ fontWeight: 800, lineHeight: 1.1, color: "text.primary", fontVariantNumeric: "tabular-nums" }}
                        >
                            {count}
                            <Box component="span" sx={{ fontSize: 14, fontWeight: 600, color: "text.secondary", ml: 0.5 }}>
                                {count === 1 ? "Day" : "Days"}
                            </Box>
                        </Typography>
                    )}
                </Box>

                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.25 }}>
                    {sub}
                </Typography>
            </CardContent>
        </Card>
    );
}

function StatsGrid({ stats, scopeLabel = "", loading = false, activeStatus, onStatusClick }) {
    return (
        <Grid container spacing={2} sx={{ mb: 3 }}>
            {CATEGORIES.map((category) => (
                <Grid key={category.key} size={{ xs: 6, sm: 6, md: 3 }}>
                    <StatCard
                        category={category}
                        count={stats[category.key] ?? 0}
                        sub={scopeLabel}
                        loading={loading}
                        onClick={onStatusClick ? () => onStatusClick(category.key) : undefined}
                        active={activeStatus === category.key}
                    />
                </Grid>
            ))}
        </Grid>
    );
}

/* ---- "Monthly Attendance Overview" bar chart --------------------
   Chart library (recharts / @mui/x-charts) project me installed
   nahi hai, aur baaki widgets (AttendanceTrendCard, AttendanceSummaryCard)
   bhi hand-rolled hi hain — to yahi pattern follow kiya hai: plain
   MUI Box + % heights. Nayi dependency nahi, poori control, aur
   theme ke saath automatically consistent.

   X = Present / Absent / Late / On Leave
   Y = number of days
   Bar ka colour `ATTENDANCE_COLORS` se aata hai — same tokens jo
   stat cards aur table ke status chips use karte hain. */

const SERIES = [
    { key: "Present", label: "Present", icon: CalendarMonthOutlined, tone: ATTENDANCE_COLORS.Present },
    { key: "Absent", label: "Absent", icon: EventBusyOutlined, tone: ATTENDANCE_COLORS.Absent },
    { key: "Late", label: "Late", icon: ScheduleOutlined, tone: ATTENDANCE_COLORS.Late },
    { key: "Leave", label: "On Leave", icon: BeachAccessOutlined, tone: ATTENDANCE_COLORS.Leave },
];

const PLOT_HEIGHT = 210;
const Y_TICKS = 4;

/* Axis ka top value — data se thoda bada aur "saaf" number, jaise
   7 din ka data ho to 8, 23 ka data ho to 25. Isse bars hamesha
   plot ke andar rehte hain aur tick labels decimal nahi bante. */
const niceMax = (values) => {
    const peak = Math.max(0, ...values);
    if (peak <= 0) return 4;
    const step = Math.ceil(peak / Y_TICKS);
    const magnitude = 10 ** Math.floor(Math.log10(step));
    const snapped = Math.ceil(step / magnitude) * magnitude;
    return Math.max(snapped, 1) * Y_TICKS;
};

/* 0 se max tak Y_TICKS equally spaced lines + unke labels. */
const yAxisTicks = (max) =>
    Array.from({ length: Y_TICKS + 1 }, (_, i) => (max / Y_TICKS) * (Y_TICKS - i));

function BarColumn({ item, value, max, loading }) {
    const heightPct = max > 0 ? (value / max) * 100 : 0;
    const { label, icon: Icon, tone } = item;

    return (
        <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Plot area — value label + bar */}
            <Box sx={{ position: "relative", height: PLOT_HEIGHT, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                {loading ? (
                    <Skeleton variant="rounded" width="100%" height={64} sx={{ borderRadius: 2 }} />
                ) : (
                    <>
                        <Typography
                            variant="caption"
                            sx={{
                                textAlign: "center",
                                fontWeight: 800,
                                color: value > 0 ? tone.main : "text.disabled",
                                fontVariantNumeric: "tabular-nums",
                                mb: 0.5,
                                lineHeight: 1.4,
                            }}
                        >
                            {value}
                        </Typography>
                        <Box
                            sx={{
                                width: "100%",
                                /* Zero value par koi invisible block na rahe —
                                   6px ki dashed stub dikhata hai, jisse
                                   "0 din" bhi ek bar ki tarah padh sake. */
                                height: value > 0 ? `${Math.max(heightPct, 4)}%` : 6,
                                borderRadius: "8px 8px 4px 4px",
                                background: value > 0
                                    ? `linear-gradient(180deg, ${tone.main}cc 0%, ${tone.main} 100%)`
                                    : "transparent",
                                border: value > 0 ? "none" : `1.5px dashed ${tone.border}`,
                                transition: "height .3s ease",
                            }}
                        />
                    </>
                )}
            </Box>

            {/* X-axis label */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mt: 1.25, minWidth: 0 }}>
                <Icon sx={{ fontSize: 15, color: tone.main, flexShrink: 0 }} />
                <Typography
                    variant="caption"
                    noWrap
                    sx={{ fontWeight: 700, color: "text.secondary", textAlign: "center" }}
                >
                    {label}
                </Typography>
            </Box>
        </Box>
    );
}

function AttendanceBarChart({ stats, scopeLabel = "", loading = false }) {
    const values = SERIES.map((s) => Number(stats[s.key]) || 0);
    const max = niceMax(values);
    const total = values.reduce((sum, v) => sum + v, 0);
    const isEmpty = !loading && total === 0;

    return (
        <Card
            elevation={0}
            sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 3 }}
        >
            <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 2.5 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary" }}>
                            Monthly Attendance Overview
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {scopeLabel ? `Number of days in ${scopeLabel}` : "Number of days by status"}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            flexShrink: 0,
                            borderRadius: 2.5,
                            color: "#4f46e5",
                            bgcolor: "#eef2ff",
                        }}
                    >
                        <BarChartOutlined sx={{ fontSize: 20 }} />
                    </Box>
                </Box>

                <Box sx={{ display: "flex", gap: 1.5 }}>
                    {/* Y axis — day counts + horizontal gridlines */}
                    <Box sx={{ position: "relative", width: 26, height: PLOT_HEIGHT, flexShrink: 0 }}>
                        {yAxisTicks(max).map((tick, i) => (
                            <Typography
                                key={i}
                                variant="caption"
                                sx={{
                                    position: "absolute",
                                    top: `${(i / Y_TICKS) * 100}%`,
                                    right: 0,
                                    transform: "translateY(-50%)",
                    fontSize: 10,
                                    fontWeight: 600,
                                    color: "text.disabled",
                                    fontVariantNumeric: "tabular-nums",
                                    lineHeight: 1,
                                }}
                            >
                                {Math.round(tick)}
                            </Typography>
                        ))}
                    </Box>

                    {/* Plot — gridlines ke upar bars */}
                    <Box sx={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
                        {/* Gridlines — pointer-events off, sirf visual guide */}
                        <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                            {yAxisTicks(max).map((tick, i) => (
                                <Box
                                    key={i}
                                    sx={{
                                        position: "absolute",
                                        top: `${(i / Y_TICKS) * 100}%`,
                                        left: 0,
                                        right: 0,
                                        height: "1px",
                                        bgcolor: i === 0 ? "divider" : "grey.100",
                                    }}
                                />
                            ))}
                        </Box>

                        <Box sx={{ position: "relative", display: "flex", gap: { xs: 1, sm: 2 } }}>
                            {SERIES.map((item) => (
                                <BarColumn
                                    key={item.key}
                                    item={item}
                                    value={Number(stats[item.key]) || 0}
                                    max={max}
                                    loading={loading}
                                />
                            ))}
                        </Box>
                    </Box>
                </Box>

                {isEmpty && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", textAlign: "center", mt: 2 }}
                    >
                        No attendance records in this period yet.
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

/* ---- Attendance history -----------------------------------------
   Desktop par MUI Table (Date | In / Out | Hours | Status), mobile
   par wahi rows stacked cards ki shakal me. Status MUI `Chip` ke
   `color` prop se aata hai (success / warning / error / info), aur
   wahi mapping table, mobile cards aur stat cards — sab ek hi. */

/* Ek row ka status Chip. `size="small"` + bold text taaki table
   ki density bani rahe, lekin chip abhi bhi pehchan aasaani rahe. */
function StatusChip({ status }) {
    const meta = statusMeta(status);
    return (
        <Chip
            label={meta.label}
            color={STATUS_CHIP_COLOR[status] || "default"}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 700 }}
        />
    );
}

/* ---- Mobile card ----
   Table ke 4 columns ko 2x2 grid + status chip me bacha diya.
   Neeche 6 AM → 10 PM wala timing bar bhi — mobile par table
   scroll karne ke bajaye yahi zyada padhne layak rehta hai. */
function MobileRowCard({ row }) {
    const status = rowStatus(row);
    const timing = rowTiming(row);
    const hours = rowHours(row);
    const hasBoth = !!(row.checkInTime && row.checkOutTime);

    return (
        <Box className="emp-att-card-row">
            <Box className="emp-att-card-top">
                <Typography component="strong" sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
                    {formatDate(row.date)}
                    {row.isToday && <span className="emp-att-today-tag">today</span>}
                </Typography>
                <StatusChip status={status} />
            </Box>

            <Box className="emp-att-card-grid">
                <Box>
                    <span>Check In</span>
                    <b>{formatTime(row.checkInTime)}</b>
                </Box>
                <Box>
                    <span>Check Out</span>
                    <b>{formatTime(row.checkOutTime)}</b>
                </Box>
                <Box>
                    <span>Hours</span>
                    <b>{hasBoth ? `${hours.toFixed(1)}h` : "—"}</b>
                </Box>
            </Box>

            <Box className="emp-att-card-tl">
                <span className="emp-att-card-tl-label">Timing</span>
                <span className="emp-att-row-tl-track">
                    <i
                        className={timing.tone}
                        style={{ left: `${timing.inPct}%`, width: `${timing.width}%` }}
                    />
                </span>
            </Box>
        </Box>
    );
}

function AttendanceHistoryTable({
    rows,
    totalRows,
    allRowCount,
    showAll,
    onToggleShowAll,
    months,
    chunk,
    onChunkChange,
    page,
    rowsPerPage,
    rowsOptions,
    onPageChange,
    statusFilter,
    onStatusFilter,
    statusCounts = {},
    onRowsPerPageChange,
    loading,
    activeLabel,
}) {
    /* "Load more" ka 14-din ka cap sirf UNFILTERED list par lagta hai —
       filter laga ho to user ne khud status chuna hai, use poore matching
       rows chahiye (warna "Absent" par click karke sirf 14 din milenge). */
    const canLoadMore = !statusFilter && allRowCount > PUNCH_DAYS;

    return (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                {/* ---- Card head + "load more" toggle ---- */}
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        px: { xs: 2, md: 2.5 },
                        py: 2,
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary" }}>
                            Attendance History
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {statusFilter
                                ? `${totalRows} ${statusFilter} day${totalRows === 1 ? "" : "s"} · ${activeLabel}`
                                : showAll
                                    ? `All ${allRowCount} punch day${allRowCount === 1 ? "" : "s"} · ${activeLabel}`
                                    : `Last ${rows.length} punch day${rows.length === 1 ? "" : "s"} · ${activeLabel}`}
                        </Typography>
                    </Box>

                    {canLoadMore && (
                        <Chip
                            label={showAll ? `Showing all ${allRowCount} days` : `Showing last ${PUNCH_DAYS} days`}
                            size="small"
                            variant="outlined"
                            onClick={onToggleShowAll}
                            sx={{ fontWeight: 700, cursor: "pointer" }}
                        />
                    )}
                </Box>

                {/* ---- Status filter chips -------------------------------
                    Stat card click karne ka equivalent, yahan bhi chips se.
                    Zaroorat isliye ki `Half-day` ka koi stat card nahi hai
                    (4 cards: Present/Absent/Late/On Leave) — par 6 ghante
                    wale din bhi dikhne chahiye. Chips par current scope
                    me us status ke row count bhi likhe hain. */}
                {!loading && (
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.75,
                            px: { xs: 2, md: 2.5 },
                            pb: 1.5,
                        }}
                    >
                        <Chip
                            label="All"
                            size="small"
                            onClick={() => onStatusFilter(null)}
                            variant={statusFilter ? "outlined" : "filled"}
                            sx={{
                                fontWeight: 700,
                                cursor: "pointer",
                                ...(statusFilter ? {} : { bgcolor: "text.primary", color: "#fff" }),
                            }}
                        />
                        {STATUS_FILTER_KEYS.map((key) => {
                            const tone = ATTENDANCE_COLORS[key] || ATTENDANCE_COLORS["No record"];
                            const n = statusCounts[key] || 0;
                            const on = statusFilter === key;
                            return (
                                <Chip
                                    key={key}
                                    label={`${key} ${n}`}
                                    size="small"
                                    onClick={() => onStatusFilter(key)}
                                    variant={on ? "filled" : "outlined"}
                                    sx={{
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        ...(on
                                            ? { bgcolor: tone.main, color: "#fff", "&:hover": { bgcolor: tone.main } }
                                            : { borderColor: tone.border, color: tone.main }),
                                    }}
                                />
                            );
                        })}
                    </Box>
                )}

                {/* ---- Month / chunk selector ---- */}
                {!loading && months.length > 0 && (
                    <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
                        <Box className="emp-att-range">
                            <button
                                type="button"
                                className={chunk === "all" ? "active" : ""}
                                onClick={() => onChunkChange("all")}
                            >
                                All months
                            </button>
                            {months.map((m) => (
                                <button
                                    type="button"
                                    key={m.key}
                                    className={chunk === m.key ? "active" : ""}
                                    onClick={() => onChunkChange(m.key)}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* ---- Body: skeleton / table+cards / empty ---- */}
                {loading ? (
                    <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} variant="text" width="100%" height={40} sx={{ mb: 1 }} />
                        ))}
                    </Box>
                ) : rows.length === 0 ? (
                    <Box className="emp-att-empty">
                        <CalendarMonthOutlined sx={{ fontSize: 34, mb: 1, opacity: 0.5 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
                            No attendance records yet
                        </Typography>
                        <Typography variant="caption">
                            Punch in to start building your history
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Desktop: table (horizontal scroll on small widths) */}
                        <Box className="emp-att-table-wrap">
                            <TableContainer
                                sx={{
                                    /* Safety net, normal state me inactive:
                                       default 10 rows (~440px) isse kam
                                       hote hain to scrollbar aata hi nahi.
                                       Sirf jab user dropdown se 25/50/100
                                       chun le tab list box me scroll hoti
                                       hai, taaki 100 rows page ko na
                                       pheela dein.

                                       `overscroll-behavior: contain`
                                       jaanbujh kar NAHI hai — wisse mouse
                                       wheel par list ke end par scroll
                                       "atak" jaata tha. Mobile wali list
                                       (`.emp-att-cards`) me bhi nested
                                       scroll nahi rakha, wahan 5 cards
                                       hote hi hain. */
                                    maxHeight: LIST_MAX_H_WIDE,
                                    overflowY: "auto",
                                }}
                            >
                                <Table className="emp-att-table" size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Date</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>In / Out</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Hours</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row) => {
                                            const hasBoth = !!(row.checkInTime && row.checkOutTime);
                                            return (
                                                <TableRow
                                                    key={row.id ?? row.date}
                                                    hover
                                                    sx={{ "&:last-child td": { borderBottom: 0 } }}
                                                >
                                                    <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                                                        {formatDate(row.date)}
                                                        {row.isToday && (
                                                            <span className="emp-att-today-tag">today</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                                        {formatTime(row.checkInTime)}
                                                        <Box component="span" sx={{ color: "text.disabled", mx: 0.5 }}>
                                                            →
                                                        </Box>
                                                        {formatTime(row.checkOutTime)}
                                                    </TableCell>
                                                    <TableCell sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                                        {/* Hours HAMESHA check-out − check-in se
                                                            (dono times hue to). Sirf tab "—"
                                                            jab check-out hi missing ho. */}
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: hasBoth ? "primary.main" : "text.disabled",
                                                                fontVariantNumeric: "tabular-nums",
                                                            }}
                                                        >
                                                            {workHours(row.checkInTime, row.checkOutTime)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusChip status={rowStatus(row)} />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        {/* Mobile: same rows as stacked cards */}
                        <Box className="emp-att-cards">
                            {rows.map((row) => (
                                <MobileRowCard key={row.id ?? row.date} row={row} />
                            ))}
                        </Box>

                        <TablePagination
                            component="div"
                            count={totalRows}
                            page={page}
                            onPageChange={(_, newPage) => onPageChange(newPage)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
                            rowsPerPageOptions={rowsOptions}
                            labelRowsPerPage="Rows"
                            sx={{ borderTop: "1px solid", borderColor: "divider" }}
                        />

                        {/* ---- "Load more" — beech me neeche wala arrow ----
                            14 → saare punch days; wapas arrow UPAR udharta
                            hai taaki user ko "collapse" karne ka hint mile. */}
                        {canLoadMore && (
                            <Box sx={{ display: "flex", justifyContent: "center", pb: 1.5 }}>
                                <Tooltip title={showAll ? "Show fewer rows" : "Load more rows"}>
                                    <IconButton
                                        onClick={onToggleShowAll}
                                        size="small"
                                        aria-label={showAll ? "Show fewer rows" : "Load more rows"}
                                        sx={{
                                            border: "1px solid",
                                            borderColor: "divider",
                                            bgcolor: "background.paper",
                                            "&:hover": { bgcolor: "grey.50", borderColor: "primary.light" },
                                        }}
                                    >
                                        <ExpandMoreRounded
                                            sx={{
                                                fontSize: 20,
                                                transition: "transform .2s ease",
                                                transform: showAll ? "rotate(180deg)" : "none",
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: PersonOutlined },
    { key: "my-profile", label: "My Profile", icon: BadgeOutlined },
    { key: "my-attendance", label: "My Attendance", icon: AccessTimeOutlined },
    { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

/* Legend ka gradient → CSS class. Hard-coded colours ko ek jagah
   rakhne ke liye `BAR_COLOR` me se derive kiya gaya hai. */
const BAR_LEGEND = [
    { label: "Present", bg: BAR_COLOR.Present },
    { label: "Half Day", bg: BAR_COLOR["Half-day"] },
    { label: "No checkout", bg: "#fde68a" },
    { label: "No record", bg: "#e2e8f0" },
];

/* ---- 12-week bar graph (Attendance History ke saath side-by-side) ----
   Har bar ek calendar week (Mon→Sun) hai aur uski height us week ke
   total ghante dikhati hai. Bar ka colour week ke overall haal se aata
   hai — absent > late > half day > present — taaki aankh seedha us
   week par jaaye jahan kuch gadbad hai.

   Ismein koi chart library nahi: plain MUI Box + % heights, bilkul
   `AttendanceBarChart` jaisa pattern, isliye naya CSS bhi nahi chahiye
   aur theme ke saath automatically consistent rehta hai. */
const WEEK_TONE = {
    Present: BAR_COLOR.Present,
    "Half-day": BAR_COLOR["Half-day"],
    Late: BAR_COLOR.Late,
    Absent: BAR_COLOR.Absent,
    "No record": "#e2e8f0",
};

const WEEK_TONE_META = {
    Present: { label: "Present", tone: ATTENDANCE_COLORS.Present },
    "Half-day": { label: "Half Day", tone: ATTENDANCE_COLORS["Half-day"] },
    Late: { label: "Late", tone: ATTENDANCE_COLORS.Late },
    Absent: { label: "Absent", tone: ATTENDANCE_COLORS.Absent },
    "No record": { label: "No record", tone: ATTENDANCE_COLORS["No record"] },
};

function WeeklyBarChart({ weeks, loading }) {
    /* Scale par hamesha 40h ka floor — warna 6-8 ghante wale normal
       weeks ke bars poore plot ko bhar lete aur farq nahi dikhta. */
    const max = Math.max(40, ...weeks.map((w) => w.hours));
    const totalHours = weeks.reduce((sum, w) => sum + w.hours, 0);
    const totalPresent = weeks.reduce((sum, w) => sum + w.present, 0);
    const isEmpty = !loading && totalHours === 0;

    return (
        <Card
            elevation={0}
            sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}
        >
            <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column" }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 2 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                            Last {WEEK_COUNT} weeks · total hours per week
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            flexShrink: 0,
                            borderRadius: 2.5,
                            color: "#4f46e5",
                            bgcolor: "#eef2ff",
                        }}
                    >
                        <BarChartOutlined sx={{ fontSize: 20 }} />
                    </Box>
                </Box>

                {/* Do summary numbers — poore 12 weeks ka total aur present days */}
                <Box sx={{ display: "flex", gap: 2.5, mb: 2 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            Total
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                            {totalHours.toFixed(0)}h
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            Present days
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                            {totalPresent}
                        </Typography>
                    </Box>
                </Box>

                {/* Plot — 12 bars, har bar apne week ka ghanta.
                    IMPORTANT: bar ka `%` apne IMMEDIATE parent ke against
                    resolve hota hai — isliye plot box ki height definite
                    (`WEEK_PLOT_H`) honi zaroori hai. Pehle yahan parent
                    auto-height tha, jisse `%` bhi auto (0) ho jata tha
                    aur saare bars invisible dikh rahe the. */}
                <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5 }}>
                    {loading
                        ? weeks.map((w) => (
                            <Box key={w.key} sx={{ flex: "1 1 0", minWidth: 0, textAlign: "center" }}>
                                <Skeleton variant="text" width={20} />
                                <Box sx={{ height: WEEK_PLOT_H, display: "flex", alignItems: "flex-end" }}>
                                    <Skeleton
                                        variant="rounded"
                                        width="100%"
                                        height={w.hours ? 60 : 30}
                                        sx={{ borderRadius: 1.5 }}
                                    />
                                </Box>
                            </Box>
                        ))
                        : weeks.map((w) => {
                            const meta = WEEK_TONE_META[w.tone] || WEEK_TONE_META["No record"];
                            const pct = w.hours > 0 ? (w.hours / max) * 100 : 0;
                            return (
                                <Tooltip key={w.key} title={`Week of ${w.label} — ${w.hours.toFixed(1)}h · ${w.present} present${w.late ? ` · ${w.late} late` : ""}${w.absent ? ` · ${w.absent} absent` : ""}`}>
                                    <Box sx={{ flex: "1 1 0", minWidth: 0, textAlign: "center" }}>
                                        <Typography
                                            sx={{
                                                fontSize: 9.5,
                                                fontWeight: 700,
                                                mb: 0.5,
                                                color: w.hours > 0 ? meta.tone.main : "text.disabled",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {w.hours > 0 ? w.hours.toFixed(0) : ""}
                                        </Typography>
                                        {/* Definite-height plot column — bar ka % yahan resolve hota hai */}
                                        <Box sx={{ height: WEEK_PLOT_H, display: "flex", alignItems: "flex-end" }}>
                                            <Box
                                                sx={{
                                                    width: "100%",
                                                    height: w.hours > 0 ? `${Math.max(pct, 6)}%` : 5,
                                                    borderRadius: "5px 5px 2px 2px",
                                                    background: w.hours > 0 ? WEEK_TONE[w.tone] : "transparent",
                                                    border: w.hours > 0 ? "none" : `1.5px dashed ${WEEK_TONE_META["No record"].tone.border}`,
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                </Tooltip>
                            );
                        })}
                </Box>

                {/* X labels — har bar ka week-start din (har doosre par,
                    taaki 12 labels ek line me na bharein */}
                <Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
                    {weeks.map((w, i) => (
                        <Typography
                            key={w.key}
                            variant="caption"
                            noWrap
                            sx={{
                                flex: "1 1 0",
                                minWidth: 0,
                                textAlign: "center",
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: w.isCurrent ? "#4f46e5" : "text.disabled",
                            }}
                        >
                            {i % 2 === 0 ? w.label : ""}
                        </Typography>
                    ))}
                </Box>

                {isEmpty && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1.5 }}>
                        No punches logged in the last {WEEK_COUNT} weeks.
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

function EmployeeAttendance() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [user, setUser] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [todayRecord, setTodayRecord] = useState(null);
    const [punchLoading, setPunchLoading] = useState(false);
    const [punchError, setPunchError] = useState("");
    const [collapsed, setCollapsed] = useState(false);
    const [page, setPage] = useState(0);
    /* Chhoti screen par 5, desktop par 10. Initial value `matchMedia`
       se turant set hoti hai — `useEffect` se set karte to mobile par
       pehla render 10 rows ka hota aur turant 5 par girta (flash). */
    const isCompactList = useMediaQuery(COMPACT_BP);
    const rowsOptions = isCompactList ? ROWS_OPTIONS_COMPACT : ROWS_OPTIONS_WIDE;
    const [rowsChoice, setRowsChoice] = useState(() => {
        const compact = typeof window !== "undefined" && window.matchMedia(COMPACT_BP).matches;
        return compact ? ROWS_PER_PAGE_MOBILE : ROWS_PER_PAGE_DESKTOP;
    });
    /* Clamp RENDER ke time par, `useEffect` se nahi. Effect me ek
       render pehle `rowsPerPage` naye breakpoint ke valid options se
       mismatch karta aur `TablePagination` ko "rowsPerPage not in
       rowsPerPageOptions" warning milta. Yahan value pehle render se
       hi valid rehti hai. `rowsChoice` raw state hai, taaki resize
       par user ka chuna hua option wapas aa sake. */
    const rowsPerPage = rowsOptions.includes(rowsChoice) ? rowsChoice : rowsOptions[0];
    const [chunk, setChunk] = useState("all");
    /* Stat card par click = history table filter. `null` = sab rows
       (koi filter nahi). Baaki values `rowStatus()` ke return hain:
       "Present" | "Half-day" | "Late" | "Absent" | "Leave" */
    const [statusFilter, setStatusFilter] = useState(null);
    /* Default true — saare punch days dikhte hain. Pehle false tha,
       to table par sirf aakhri 14 din aate the aur baaki data
       chhupne ka laga tha (arrow dabane ke baad bhi ek aur
       pagination layer tha). */
    const [showAllRows, setShowAllRows] = useState(true);

    /* ---- Rows-per-page: breakpoint ke hisaab se adjust ------------- */
    /* Clamp upar render-time par ho raha hai, isliye ye effect ki zaroorat
       nahi. `rowsChoice` jaanbujh kar NAHI reset hota — desktop par user
       ne 50 chuna aur window chhoti hui to render par value 5 ho jaati
       hai, par chhoti screen par wapas 50 chunne ke baad user ka choice
       (`rowsChoice`) bacha milta hai. */

    /* ---- Scroll lock: element move ho to page na scroll ho --------- */
    /* Page change, 5<->10 switch, ya "load more" par list ki height badal
       jaati hai. Browser scrollY hold karke rakhta hai, to us hisab se
       viewport ka content "upar-uthtar" jump karta dikhta hai — user ko
       lagta hai page khud scroll ho gaya. Isliye change se PEHLE scrollY
       pakad lo aur render ke baad wahi position par wapas set kar do.

       `useLayoutEffect` (useEffect nahi) zaroori hai — ye DOM mutation
       ke baad lekin PAINT se pehle chalta hai, to jump frame ban hi
       nahi pata chalega. */
    const scrollRestoreRef = useRef(null);

    const withScrollLock = (fn) => (...args) => {
        scrollRestoreRef.current = window.scrollY;
        return fn(...args);
    };

    useLayoutEffect(() => {
        if (scrollRestoreRef.current === null) return;
        window.scrollTo(0, scrollRestoreRef.current);
        scrollRestoreRef.current = null;
    });

    const handlePageChange = withScrollLock((nextPage) => setPage(nextPage));
    const handleRowsPerPageChange = withScrollLock((next) => setRowsChoice(next));
    const handleToggleShowAll = withScrollLock(() => setShowAllRows((v) => !v));

    /* Stat card / chip par click. Same card dobara dabane par filter
       hat jaata hai (toggle). Page 0 par wapas isliye jaate hain —
       filtered list chhoti ho sakti hai, warna user last page par
       khaali table dekh raha hoga. */
    const handleStatusFilter = withScrollLock((key) => {
        setStatusFilter((prev) => (prev === key ? null : key));
        setPage(0);
    });

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch { setUser(null); }
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadAll = async () => {
        setLoading(true);
        setError("");
        const { from, to } = historyRange();

        const [historyRes, todayRes] = await Promise.allSettled([
            attendanceServ.getMyHistory(from, to),
            attendanceServ.getToday(),
        ]);

        if (historyRes.status === "fulfilled") {
            setAttendance(unwrap(historyRes.value).map(normalizeRow));
        } else {
            setError(
                historyRes.reason?.response?.data?.message
                || historyRes.reason?.response?.data?.title
                || "Failed to load attendance data"
            );
        }

        /* Aaj ka punch alag endpoint se — history me aaj ki entry na
           mile (jaise abhi check-in nahi kiya) to button status hi
           sahi dikhata hai. */
        setTodayRecord(todayRes.status === "fulfilled" ? normalizeRow(unwrapOne(todayRes.value)) : null);

        setLoading(false);
    };

    /* Check In / Check Out — button ki current state se decide hota
       hai kaunsa endpoint call karna hai. */
    const handlePunch = async () => {
        setPunchLoading(true);
        setPunchError("");
        try {
            const res = todayRecord?.checkInTime && !todayRecord?.checkOutTime
                ? await attendanceServ.checkOut()
                : await attendanceServ.checkIn();
            setTodayRecord(normalizeRow(res));
            const { from: f, to: t } = historyRange();
            const [historyRes, todayRes] = await Promise.allSettled([
                attendanceServ.getMyHistory(f, t),
                attendanceServ.getToday(),
            ]);
            if (historyRes.status === "fulfilled") {
                setAttendance(unwrap(historyRes.value).map(normalizeRow));
            }
            if (todayRes.status === "fulfilled") {
                setTodayRecord(normalizeRow(unwrapOne(todayRes.value)));
            }
        } catch (e) {
            setPunchError(e?.response?.data?.message || e?.response?.data || "Could not record attendance");
        } finally {
            setPunchLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
        : "Employee";

    /* ---------------- Saare calculations ek jagah ----------------
       `attendance` = last 6 mahine ka poora data. Teen parts:
       1) `months`      — data me maujood months (newest first)
       2) `monthRows`   — user ne jo month/chunk select kiya
       3) `chartData`   — hamesha aakhri 7 calendar din
       Summary cards, insights aur timeline `monthRows` par chalte
       hain, isliye month switch karte hi sab update ho jaata hai. */

    /* Data me jo months maujood hain — naya pehle. Current month
       hamesha list me rahega (chahe abhi koi record na ho), warna
       naye employee ke paas selector khaali aa jayega. */
    const months = useMemo(() => {
        const keys = new Set(attendance.map((r) => (r.date ? dayKey(new Date(r.date)).slice(0, 7) : null)).filter(Boolean));
        keys.add(dayKey(new Date()).slice(0, 7));
        return [...keys]
            .sort((a, b) => b.localeCompare(a))
            .map((key) => {
                const [y, m] = key.split("-");
                return { key, label: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }) };
            });
    }, [attendance]);

    /* Chunk filter ("2026-09", "2026-08" … ya "all"). Chunks ko
       month key ki tarah hi treat karte hain, isliye ek hi filter
       dono ke liye kaam karta hai. */
    const monthRows = useMemo(() => {
        if (chunk === "all") return attendance;
        return attendance.filter((r) => r.date && dayKey(new Date(r.date)).startsWith(chunk));
    }, [attendance, chunk]);

    /* ---- Table rows: PUNCH DAYS (real records) ---------------
       Pehle yahan "calendar densification" thi — har din ki row
       banti thi, `isRecord` flag se decide hota tha. Par `chunk`
       default "all" hone par ye list BILKUL bypass ho jaati thi
       (`return monthRows`) aur raw API rows aa jaate the jinme
       `isRecord` property hi nahi hoti — isliye har ASLI record
       table me "No record" + Hours "—" dikh raha tha (In/Out times
       to direct render hote the, isliye dikhte the).

       Ab list saaf hai: sirf wahi days jisme check-in hua, naye se
       purane, aur har row par `isRecord`/`isToday` explicitly set
       hai. Default sirf aakhri 14 punch days ("load more" se poore). */
    const allPunchDays = useMemo(() => {
        const todayK = dayKey(new Date());
        return monthRows
            .filter((r) => r.checkInTime)
            .map((r) => ({
                ...r,
                isRecord: true,
                isToday: dayKey(new Date(r.date)) === todayK,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [monthRows]);

    /* ---- Status filter ke liye poori list -----------------------
       `allPunchDays` sirf wo rows rakhta jisme check-in hai, to
       Absent/Leave (jinme punch hota hi nahi) usme kabhi aate hi nahi
       the — "Absent" par click kare to table khaali dikhti. Isliye
       filter ki list me SAARE rows jaate hain, punch ya na punch. */
    const statusRows = useMemo(() => {
        const todayK = dayKey(new Date());
        return monthRows
            .map((r) => ({
                ...r,
                isRecord: !!r.checkInTime,
                isToday: dayKey(new Date(r.date)) === todayK,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [monthRows]);

    const filteredRows = useMemo(() => {
        if (!statusFilter) return allPunchDays;
        return statusRows.filter((r) => rowStatus(r) === statusFilter);
    }, [statusFilter, allPunchDays, statusRows]);

    /* Filter chip row me har status ke saath kitne rows hain, wo count.
       Cards ka count `stats` se aata hai (poore month ka), yaha sirf
       CURRENT chunk ke rows — isliye dono numbers alag ho sakte hain. */
    const statusCountsInScope = useMemo(() => {
        const counts = {};
        statusRows.forEach((r) => {
            const s = rowStatus(r);
            counts[s] = (counts[s] || 0) + 1;
        });
        return counts;
    }, [statusRows]);

    const tableRows = statusFilter
        ? filteredRows
        : showAllRows
            ? allPunchDays
            : allPunchDays.slice(0, PUNCH_DAYS);

    const stats = useMemo(() => {
        const rows = attendance;
        const byDate = new Map(rows.map((r) => [dayKey(new Date(r.date)), r]));

        const scoped = monthRows;
        const totalDays = scoped.length;

        /* Counts `rowStatus()` se — matlab EXACTLY wahi values jo history
           table aur charts dikhate hain. Pehle raw `a.status` (backend
           string) padha jaata tha, jisse do problem thi:
             1) Late card ka count table ke "Late" rows se alag ho sakta
                tha (backend `status: "Present"` + `isLate: true`),
             2) "Present" card late days ko bhi ginta tha, to total
                Present + Late double-count ho jata tha.
           Filter lagane par ye mismatch turant dikhta — user click karta
           to "Present 51" likha hota par table me 44 rows aate. */
        const countTodayK = dayKey(new Date());
        const statusCounts = {};
        scoped.forEach((r) => {
            const s = rowStatus({ ...r, isToday: dayKey(new Date(r.date)) === countTodayK });
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
        const presentDays = statusCounts.Present || 0;
        const absentDays = statusCounts.Absent || 0;
        const halfDays = statusCounts["Half-day"] || 0;
        const leaveDays = statusCounts.Leave || 0;
        const lateDays = statusCounts.Late || 0;

        /* Average sirf un dino ka jisme actually ghante bane —
           absent/leave din 0 ghante ka hissa nahi hone chahiye. */
        const workedRows = scoped.filter((r) => rowHours(r) > 0);
        const avgHours = workedRows.length
            ? workedRows.reduce((sum, r) => sum + rowHours(r), 0) / workedRows.length
            : 0;

        const overtimeHours = workedRows.reduce(
            (sum, r) => sum + Math.max(0, rowHours(r) - STANDARD_HOURS), 0);

        /* Streak: sabse naye record ki taraf se peeche — jab tak
           consecutive din punch hue hain. Aaj ka record abhi bana
           nahi hua to use skip karte hain (streak toot-na nahi
           chahiye sirf isliye ki employee abhi aaya nahi). Month
           selection se independent rehta hai — streak hamesha
           "aaj se kitne continuous din" hi hota hai. */
        let streak = 0;
        const todayKey = dayKey(new Date());
        const newestFirst = [...rows].sort(
            (a, b) => new Date(b.date) - new Date(a.date));
        for (const r of newestFirst) {
            const isToday = dayKey(new Date(r.date)) === todayKey;
            if (isToday && !r.checkInTime) continue;
            if (!workedDay(r)) break;
            streak += 1;
        }

        const pct = (n) => (totalDays ? Math.round((n / totalDays) * 100) : 0);

        /* ---- 7-din chart: calendar ke aakhri 7 din, records se map
           kiye hue. Isse axis par hamesha 7 labels milte hain.
           IMPORTANT: record na hone par `hours` ko EXPLICIT 0 set
           hota hai (undefined nahi) — isliye har din ka bar 0-height
           state me jaata hai, "missing data" state me nahi.

           `kind` chart ko batata hai ki din ka kya haal hai:
             logged → ghante > 0 (gradient bar)
             open   → AAJ ka record, checkout abhi nahi → LIVE ghante
             zero   → record hai par ghante 0 (check-in, no checkout)
             stale  → record hai, checkout nahi, par din purana hai
                      (galat punch) → 0 ghante, warning dikhega
             none   → record hi nahi → dashed outline */
        const chartData = [];
        for (let i = CHART_DAYS - 1; i >= 0; i -= 1) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const r = byDate.get(dayKey(d)) || null;
            const isToday = dayKey(d) === dayKey(new Date());
            /* Aaj ka khula record → ab tak ke ghante live count karo,
               warna 27 Sept type ka din chart me 0.0 dikhta hai jabki
               employee 3 ghante se kaam kar raha hai. */
            const liveH = (r?.checkInTime && !r?.checkOutTime && isToday)
                ? Math.max(0, (new Date() - new Date(r.checkInTime)) / 3600000)
                : 0;
            const hours = r ? (liveH > 0 ? liveH : rowHours(r)) : 0;
            const open = !!(r?.checkInTime && !r?.checkOutTime);
            let kind = "none";
            if (r) {
                if (liveH > 0) kind = "open";
                else if (hours > 0) kind = "logged";
                else if (open) kind = isToday ? "open" : "stale";
                else kind = "zero";
            }
            chartData.push({
                key: dayKey(d),
                row: r,
                hours,
                kind,
                open,
                isToday,
                /* Chart ka status bhi WAHI helper se — table aur chart
                   kabhi alag value na dikhayein. */
                status: rowStatus({ ...(r || {}), isToday }),
                dbStatus: r?.status || null,
                late: r ? (r.isLate === true || r.status === "Late") : false,
                day: d.toLocaleDateString("en-IN", { day: "2-digit" }),
                month: d.toLocaleDateString("en-IN", { month: "short" }),
                week: d.toLocaleDateString("en-US", { weekday: "short" }),
                full: d,
            });
        }

        return {
            totalDays, presentDays, absentDays, halfDays, leaveDays, lateDays,
            avgHours, overtimeHours, streak, pct, chartData, workedDays: workedRows.length,
        };
    }, [attendance, monthRows]);

    /* Stat cards + "Monthly Attendance Overview" chart dono INHI
       chaar numbers par chalte hain, isliye ek hi object bana kar
       dono components ko diya gaya hai — do jagah alag key names
       likhne se count kabhi mismatch ho jaata hai. */
    const summary = useMemo(
        () => ({
            Present: stats.presentDays,
            Absent: stats.absentDays,
            Late: stats.lateDays,
            Leave: stats.leaveDays,
        }),
        [stats]
    );

    /* Scale: 8h ka baseline, taaki 6h ka din bhi 75% dikhaye.
       Warna 3h ke max par scale hota to sab bars nearly full lagte. */
    const chartMax = Math.max(STANDARD_HOURS, ...stats.chartData.map((d) => d.hours));
    const chartPeak = stats.chartData.length ? Math.max(...stats.chartData.map((d) => d.hours)) : 0;
    /* Card header ka "total" — sirf un 7 din ka, jinme ghante bane */
    const chartTotal = stats.chartData.reduce((sum, d) => sum + d.hours, 0);

    /* ---- 12-week buckets (weekly bar graph ke liye) ----
       `attendance` (poora 6-mahine ka data) ko calendar weeks
       (Mon→Sun) me baantte hain — pichle 11 week + yeh current week.
       Har bucket me ghante, present/late/absent counts aur ek overall
       "tone" (Absent > Late > Half Day > Present), jisse bar ka colour
       decide hota hai.

       Month/chunk selector se yeh CHEHUTA hai: weekly trend hamesha
       "ab ke pichle 12 hafte" dikhata hai, kahi se bhi, warna chart
       month switch karte hi khali ho jaata. */
    const weeklyData = useMemo(() => {
        const thisWeek = weekStartOf(new Date());
        const buckets = [];
        for (let i = WEEK_COUNT - 1; i >= 0; i -= 1) {
            const start = new Date(thisWeek);
            start.setDate(start.getDate() - i * 7);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);

            const rows = attendance.filter((r) => {
                if (!r.date) return false;
                const t = new Date(r.date);
                return t >= start && t < end;
            });

            const hours = rows.reduce((sum, r) => sum + rowHours(r), 0);
            const present = rows.filter((r) => rowStatus({ ...r, isToday: false }) === "Present").length;
            const half = rows.filter((r) => {
                const s = rowStatus({ ...r, isToday: false });
                return s === "Half-day" || s === "HalfDay";
            }).length;
            const late = rows.filter((r) => r.isLate === true || r.status === "Late").length;
            const absent = rows.filter((r) => r.status === "Absent").length;

            let tone = "No record";
            if (absent > 0) tone = "Absent";
            else if (late > 0) tone = "Late";
            else if (half > 0) tone = "Half-day";
            else if (present > 0) tone = "Present";
            /* Check-in hai par check-out nahi (galat/incomplete punch) —
               ghante ban gaye to use "No record" mat bolo, Present maano. */
            else if (hours > 0) tone = "Present";

            buckets.push({
                key: dayKey(start),
                label: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
                hours,
                present,
                half,
                late,
                absent,
                days: rows.length,
                tone,
                isCurrent: i === 0,
            });
        }
        return buckets;
    }, [attendance]);

    /* Pagination — table aur mobile cards dono sliced rows se bante hain.
       Month/chunk badalne par page 0 par wapas jate hain (naya data
       chhota ho sakta hai, warna user last page par khada rahega). */
    const pagedRows = useMemo(
        () => tableRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [tableRows, page, rowsPerPage]
    );

    useEffect(() => { setPage(0); }, [chunk, rowsPerPage, statusFilter]);

    /* Chart debug — har din ka record, hours aur status console me.
       Production build me automatically hat jata hai. Isse pata
       chalta hai ki koi din data se missing hai ya value 0 hai. */
    useEffect(() => {
        if (process.env.NODE_ENV === "production") return;
        console.log("[MyAttendance] last 7 days →", stats.chartData.map((d) => ({
            date: d.key,
            kind: d.kind,
            hours: d.hours,
            status: d.status,
            checkIn: d.row?.checkInTime || null,
            checkOut: d.row?.checkOutTime || null,
        })));
    }, [stats.chartData]);

    const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

    /* Selected chunk ka label — summary cards ka sub-text isi par
       chalta hai, taaki pata chale numbers kis month ke hain. */
    const activeLabel = chunk === "all"
        ? `Last ${HISTORY_DAYS / 30 | 0} months`
        : months.find((m) => m.key === chunk)?.label || currentMonth;

    return (
        <div className="dash-page emp-page">
            <Sidebar activeKey="my-attendance" onLogout={handleLogout} title="HRMS" user={user} navItems={EMPLOYEE_NAV_ITEMS} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar userName={displayName} userRole={user?.role || "EMPLOYEE"} user={user} onLogout={handleLogout} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
                <div className="dash-content">

                    {/* 1 — Header */}
                    <AttendanceHeader monthLabel={currentMonth} scopeLabel={activeLabel} />

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                    {/* 2 — Summary stat cards (Present / Absent / Late / On Leave).
                        Pehle yahan "Today's attendance" card tha. Ab counts sabse
                        upar hain, aur punch card neeche — taaki employee ko
                        pehle summary dikhe, action (Check In / Out) baad me. */}
                    <StatsGrid
                        stats={summary}
                        scopeLabel={activeLabel}
                        loading={loading}
                        activeStatus={statusFilter}
                        onStatusClick={handleStatusFilter}
                    />

                    {/* 3 — Today's attendance */}
                    <Box sx={{ mb: 3 }}>
                        <TodayAttendanceCard
                            todayRecord={todayRecord}
                            loading={loading}
                            punchLoading={punchLoading}
                            punchError={punchError}
                            onPunch={handlePunch}
                        />
                    </Box>

                    {/* 4 — Monthly attendance overview (bar chart) */}
                    <AttendanceBarChart stats={summary} scopeLabel={activeLabel} loading={loading} />

                    {/* ---- Last 7 days — ghante ka chart ----
                        Monthly overview ke saath saath: wo "is mahine
                        me kitne din" batata hai, ye "aaj kal ghante
                        kitne" batata hai. */}
                    <Card
                        className="emp-att-chart-card"
                        elevation={0}
                        sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 3 }}
                    >
                        <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: 2.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 38,
                                            height: 38,
                                            flexShrink: 0,
                                            borderRadius: 2.5,
                                            color: "#4f46e5",
                                            bgcolor: "#eef2ff",
                                        }}
                                    >
                                        <BarChartOutlined sx={{ fontSize: 20 }} />
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary" }}>
                                            Last 7 days — hours worked
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Hours logged per day, with day status
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ display: "flex", gap: 2, flexShrink: 0 }}>
                                    <Box sx={{ textAlign: "right" }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                            Total
                                        </Typography>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                                            {chartTotal.toFixed(1)}h
                                        </Typography>
                                    </Box>
                                    <Box sx={{ textAlign: "right" }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                            Peak day
                                        </Typography>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                                            {chartPeak.toFixed(1)}h
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>

                            {loading ? (
                                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", height: 150 }}>
                                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                        <Skeleton key={i} variant="rounded" width="100%" height={40 + i * 8} />
                                    ))}
                                </Box>
                            ) : (
                                <>
                                    {/* `.emp-att-chart` sirf tooltip ke liye upar
                                        jagah banata hai. Bars HAMESHA render hote
                                        hain — pehle yahan ek "saare 7 din empty"
                                        early-return tha jo poora chart hata deta
                                        tha, isliye kisi record na hone par graph
                                        dikhta hi nahi tha. Ab `kind: "none"` wale
                                        din dashed stub ki shakal me axis ke saath
                                        dikhte hain, aur upar ek chhoti line. */}
                                    <div className="emp-att-chart">
                                    {chartPeak === 0 && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ display: "block", textAlign: "center", mb: 1 }}
                                        >
                                            No punches logged in the last 7 days.
                                        </Typography>
                                    )}
                                    <div className="emp-att-bars-scroll">
                                        <div className="emp-att-bars">
                                            {/* 8h reference line — 0h aur 10h ke beech
                                                ka farq visually clear hota hai. */}
                                            <span
                                                className="emp-att-chart-ref"
                                                style={{ bottom: `${(STANDARD_HOURS / chartMax) * 100}%` }}
                                            >
                                                <em>{STANDARD_HOURS}h</em>
                                            </span>
                                            {stats.chartData.map((d) => {
                                                const meta = statusMeta(d.status);
                                                const StatusIcon = meta.icon;
                                                /* Tooltip: date + check-in + check-out
                                                   + total hours + status. */
                                                const tip = d.row
                                                    ? `${d.week}, ${d.day} ${d.month} — In ${d.row.checkInTime ? new Date(d.row.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} · Out ${d.row.checkOutTime ? new Date(d.row.checkOutTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "not checked out"} · ${d.hours > 0 ? `${d.hours.toFixed(1)}h` : "0.0h (no hours logged)"}${d.late ? " · Late" : ""} · ${meta.label}`
                                                    : `${d.week}, ${d.day} ${d.month} — no record · 0.0h`;
                                                /* Har din ka bar ALWAYS render hota hai:
                                                   logged/open → gradient + % height,
                                                   zero/stale → grey outline (6px),
                                                   none       → dashed outline (6px).
                                                   Isse koi din invisible nahi hota. */
                                                return (
                                                    <div
                                                        className={`emp-att-bar-col ${d.kind}`}
                                                        key={d.key}
                                                        aria-label={tip}
                                                    >
                                                        <span className="emp-att-bar-tip" role="tooltip">{tip}</span>
                                                        <span className={`emp-att-bar-val ${d.kind}`}>
                                                            {d.hours > 0 ? d.hours.toFixed(1) : "0.0"}
                                                        </span>
                                                        <div className="emp-att-bar-track">
                                                            <div
                                                                className={`emp-att-bar-fill ${d.kind}`}
                                                                style={{
                                                                    height: d.hours > 0
                                                                        ? `${Math.max(8, (d.hours / chartMax) * 100)}%`
                                                                        : "6px",
                                                                    background: d.hours > 0
                                                                        ? (d.kind === "open" ? "linear-gradient(180deg, #a5b4fc 0%, #6366f1 100%)" : barColor(d.status, d.hours))
                                                                        : "transparent",
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="emp-att-bar-label">
                                                            <b>{d.week}</b>
                                                            {d.day} {d.month}
                                                        </span>
                                                        <span
                                                            className="emp-att-bar-status"
                                                            style={{ color: meta.fg, background: meta.bg, borderColor: meta.border }}
                                                        >
                                                            <StatusIcon /> {meta.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="emp-att-chart-foot">
                                        {BAR_LEGEND.map((l) => (
                                            <span key={l.label} className="emp-att-legend">
                                                <i style={{ background: l.bg }} /> {l.label}
                                            </span>
                                        ))}
                                    </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* 5 — Attendance history + 12-week graph
                        Pehle 6/6 (table left, chart right) tha, par table ki
                        4 columns + month selector + pagination ek aadha screen
                        me squeeze ho rahe the. Ab dono poori width (lg: 12) me
                        hain — table upar, weekly graph neeche. */}
                    <Grid container spacing={2} alignItems="stretch" sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, lg: 12 }}>
                            <AttendanceHistoryTable
                                rows={pagedRows}
                                totalRows={tableRows.length}
                                allRowCount={allPunchDays.length}
                                showAll={showAllRows}
                                  onToggleShowAll={handleToggleShowAll}
                                  months={months}
                                  chunk={chunk}
                                  onChunkChange={setChunk}
                                  page={page}
                                  rowsPerPage={rowsPerPage}
                                  rowsOptions={rowsOptions}
                                  onPageChange={handlePageChange}
                                  statusFilter={statusFilter}
                                  onStatusFilter={handleStatusFilter}
                                  statusCounts={statusCountsInScope}
                                  onRowsPerPageChange={handleRowsPerPageChange}
                                loading={loading}
                                activeLabel={activeLabel}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 12 }}>
                            <WeeklyBarChart weeks={weeklyData} loading={loading} />
                        </Grid>
                    </Grid>

                </div>
            </div>
        </div>
    );
}

export default EmployeeAttendance;
