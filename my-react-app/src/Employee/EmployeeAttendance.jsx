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
import AttendanceHeader from "./components/attendance/AttendanceHeader";
import TodayCard from "./components/attendance/TodayCard";
import MonthCalendar from "./components/attendance/MonthCalendar";
import DaySheet from "./components/attendance/DaySheet";
import RecentLogs from "./components/attendance/RecentLogs";
import AttendanceHistoryView from "./components/attendance/AttendanceHistoryView";
import useAttendancePunch from "./components/attendance/useAttendancePunch";
import useTodayState from "./components/attendance/useTodayState";
import {
    dayKey,
    formatDuration,
    monthRange,
    normalizeRow,
    unwrapList,
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
    const [searchParams, setSearchParams] = useSearchParams();
    const isHistoryView = searchParams.get("view") === "history";

    const [user, setUser] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(
        () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
    const requestRef = useRef(0);

    const {
        state: todayState,
        loading: todayLoading,
        error: todayError,
        now,
        elapsedSeconds,
        refresh: refreshTodayState,
    } = useTodayState();

    const todayRecord = useMemo(() => {
        if (!todayState?.attendance) return null;
        return normalizeRow({
            ...todayState.attendance,
            date: todayState.attendanceDate,
        });
    }, [todayState]);

    const todayKey = dayKey(todayState?.attendanceDate || new Date());
    const elapsed = formatDuration(elapsedSeconds * 1000);
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

        try {
            const response = await attendanceServ.getMyHistory(from, to);
            if (requestRef.current !== requestId) return;
            setRows(unwrapList(response).map(normalizeRow));
        } catch (requestError) {
            if (requestRef.current !== requestId) return;
            setRows([]);
            setError(
                requestError.response?.data?.message
                || "Attendance history load nahi ho paayi."
            );
        } finally {
            if (requestRef.current === requestId && !silent) setLoading(false);
        }
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

    const handlePunchSuccess = useCallback(async () => {
        await Promise.all([
            loadMonth(true),
            refreshTodayState({ silent: true }),
        ]);
    }, [loadMonth, refreshTodayState]);

    const {
        punch,
        punchLoading,
        punchStage,
        punchError,
    } = useAttendancePunch({
        todayRecord,
        todayState,
        now,
        onSuccess: handlePunchSuccess,
    });

    const handlePunch = async () => {
        const result = await punch();
        if (result.ok) {
            setToast({
                open: true,
                severity: result.warning ? "warning" : "success",
                message: result.warning
                    || (result.mode === "out" ? "Check-out successful" : "Check-in successful"),
            });
        } else {
            setToast({
                open: true,
                severity: "error",
                message: result.message || "Attendance record nahi ho paaya.",
            });
        }
    };

    const retryAll = () => {
        loadMonth();
        refreshTodayState();
    };

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
                                            <Button variant="contained" onClick={retryAll}>
                                                Retry
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <TodayCard
                                                state={todayState}
                                                record={todayRecord}
                                                loading={todayLoading}
                                                stateError={todayError}
                                                elapsed={elapsed}
                                                now={now}
                                                punchLoading={punchLoading}
                                                punchStage={punchStage}
                                                punchError={punchError}
                                                onPunch={handlePunch}
                                            />

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
