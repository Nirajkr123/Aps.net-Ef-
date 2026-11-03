import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Snackbar } from "@mui/material";
import {
    AccessTimeOutlined,
    AssignmentOutlined,
    EventOutlined,
    PaymentsOutlined,
    PersonOutlined,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import attendanceServ from "../services/attendanceService";
import useIsMobile from "../hooks/useIsMobile";
import StatCard from "./components/dashboard/StatCard";
import BottomNav from "./components/dashboard/BottomNav";
import AttendanceHeader from "./components/attendance/AttendanceHeader";
import TodayCard from "./components/attendance/TodayCard";
import MonthCalendar from "./components/attendance/MonthCalendar";
import DaySheet from "./components/attendance/DaySheet";
import RecentLogs from "./components/attendance/RecentLogs";
import AttendanceHistoryView from "./components/attendance/AttendanceHistoryView";
import useAttendancePunch from "./components/attendance/useAttendancePunch";
import {
    dayKey,
    formatDuration,
    monthRange,
    normalizeRow,
    rowStatus,
    unwrapList,
    unwrapOne,
} from "./components/attendance/attendanceUtils";

import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";
import "./EmployeeAttendance.css";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: AssignmentOutlined },
    { key: "my-profile", label: "My Profile", icon: PersonOutlined },
    { key: "my-attendance", label: "My Attendance", icon: AccessTimeOutlined },
    { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

function EmployeeAttendance() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [searchParams, setSearchParams] = useSearchParams();
    const isHistoryView = searchParams.get("view") === "history";

    const [user, setUser] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(
        () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const [rows, setRows] = useState([]);
    const [todayRecord, setTodayRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [elapsed, setElapsed] = useState("00:00:00");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
    const requestRef = useRef(0);

    const todayKey = dayKey(new Date());
    const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const canGoNext = selectedMonth.getFullYear() < currentMonth.getFullYear()
        || (
            selectedMonth.getFullYear() === currentMonth.getFullYear()
            && selectedMonth.getMonth() < currentMonth.getMonth()
        );

    const loadMonth = useCallback(async (silent = false) => {
        const requestId = requestRef.current + 1;
        requestRef.current = requestId;

        if (!silent) setLoading(true);
        setError("");

        const { from, to } = monthRange(selectedMonth);
        const [historyResult, todayResult] = await Promise.allSettled([
            attendanceServ.getMyHistory(from, to),
            attendanceServ.getToday(),
        ]);

        if (requestRef.current !== requestId) return;

        let message = "";

        if (historyResult.status === "fulfilled") {
            setRows(unwrapList(historyResult.value).map(normalizeRow));
        } else {
            setRows([]);
            message = historyResult.reason?.response?.data?.message
                || "Attendance history load nahi ho paayi.";
        }

        if (todayResult.status === "fulfilled") {
            setTodayRecord(normalizeRow(unwrapOne(todayResult.value)));
        } else {
            setTodayRecord(null);
            message = message
                || todayResult.reason?.response?.data?.message
                || "Today's attendance load nahi ho paayi.";
        }

        if (message) setError(message);
        if (!silent) setLoading(false);
    }, [selectedMonth]);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        loadMonth();
    }, [loadMonth]);

    useEffect(() => {
        if (!todayRecord?.checkInTime) {
            setElapsed("00:00:00");
            return undefined;
        }

        const start = new Date(todayRecord.checkInTime).getTime();
        const end = todayRecord.checkOutTime ? new Date(todayRecord.checkOutTime).getTime() : null;
        const tick = () => setElapsed(formatDuration((end ?? Date.now()) - start));
        tick();

        if (end) return undefined;

        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [todayRecord?.checkInTime, todayRecord?.checkOutTime]);

    const handlePunchSuccess = useCallback(async () => {
        await loadMonth(true);
    }, [loadMonth]);

    const {
        punch,
        punchLoading,
        punchStage,
        punchError,
    } = useAttendancePunch({
        todayRecord,
        onSuccess: handlePunchSuccess,
    });

    const handlePunch = async () => {
        const result = await punch();
        if (result.ok) {
            setToast({
                open: true,
                severity: "success",
                message: result.mode === "out" ? "Check-out successful" : "Check-in successful",
            });
        } else {
            setToast({
                open: true,
                severity: "error",
                message: result.message || "Attendance record nahi ho paaya.",
            });
        }
    };

    const stats = useMemo(() => {
        let present = 0;
        let late = 0;
        let absent = 0;

        rows.forEach((row) => {
            const status = rowStatus({
                ...row,
                isToday: dayKey(row.date) === todayKey,
            });
            if (status === "Present") present += 1;
            else if (status === "Late") late += 1;
            else if (status === "Absent") absent += 1;
        });

        return { present, late, absent };
    }, [rows, todayKey]);

    const selectedRecord = useMemo(() => {
        if (!selectedDay) return null;
        const key = dayKey(selectedDay);
        return rows.find((row) => dayKey(row.date) === key) || null;
    }, [rows, selectedDay]);

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
        : "Employee";

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const goToPreviousMonth = () => {
        setSheetOpen(false);
        setSelectedDay(null);
        setSelectedMonth((previous) => (
            new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
        ));
    };

    const goToNextMonth = () => {
        if (!canGoNext) return;
        setSheetOpen(false);
        setSelectedDay(null);
        setSelectedMonth((previous) => (
            new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
        ));
    };

    const openDay = (date) => {
        setSelectedDay(date);
        setSheetOpen(true);
    };

    const closeToast = () => {
        setToast((previous) => ({ ...previous, open: false }));
    };

    return (
        <div className="dash-page emp-page emp-att-page">
            <Sidebar
                activeKey="my-attendance"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                navItems={EMPLOYEE_NAV_ITEMS}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            <div className={`dash-main ${sidebarCollapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={user?.role || "EMPLOYEE"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                />

                <div className="dash-content emp-att-content">
                    <div className="emp-att-shell">
                        {isHistoryView ? (
                            <AttendanceHistoryView onBack={() => setSearchParams({})} />
                        ) : (
                            <>
                                <AttendanceHeader
                                    month={selectedMonth}
                                    onPrevious={goToPreviousMonth}
                                    onNext={goToNextMonth}
                                    canGoNext={canGoNext}
                                />

                                <div className="emp-att-overview">
                                    {error ? (
                                        <div className="emp-att-error-card">
                                            <p>{error}</p>
                                            <Button variant="contained" onClick={() => loadMonth()}>
                                                Retry
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <TodayCard
                                                record={todayRecord}
                                                loading={loading}
                                                elapsed={elapsed}
                                                punchLoading={punchLoading}
                                                punchStage={punchStage}
                                                punchError={punchError}
                                                onPunch={handlePunch}
                                            />

                                            <div className="emp-att-stats">
                                                <StatCard
                                                    value={stats.present}
                                                    label="Present"
                                                    tone="green"
                                                    loading={loading}
                                                />
                                                <StatCard
                                                    value={stats.late}
                                                    label="Late"
                                                    tone="amber"
                                                    loading={loading}
                                                />
                                                <StatCard
                                                    value={stats.absent}
                                                    label="Absent"
                                                    tone="red"
                                                    loading={loading}
                                                />
                                            </div>

                                            <div className="emp-att-columns">
                                                <MonthCalendar
                                                    month={selectedMonth}
                                                    rows={rows}
                                                    todayKey={todayKey}
                                                    loading={loading}
                                                    onSelectDay={openDay}
                                                />
                                                <RecentLogs
                                                    rows={rows}
                                                    todayKey={todayKey}
                                                    loading={loading}
                                                    onViewAll={() => setSearchParams({ view: "history" })}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {isMobile && <BottomNav />}

            <DaySheet
                open={sheetOpen}
                day={selectedDay}
                record={selectedRecord}
                onClose={() => setSheetOpen(false)}
            />

            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={closeToast}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert onClose={closeToast} severity={toast.severity} sx={{ width: "100%" }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default EmployeeAttendance;
