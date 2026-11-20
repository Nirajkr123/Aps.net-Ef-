import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Alert, Button, Snackbar } from "@mui/material";
import {
    AccessTimeOutlined,
    AssignmentOutlined,
    CheckCircleOutlined,
    EventOutlined,
    PersonOutlined,
    PaymentsOutlined,
    TrendingUpOutlined,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import dashboardServ from "../services/dashboardService";
import { useLeave } from "../context/LeaveContext";
import ApplyLeaveForm from "./components/leaves/ApplyLeaveForm";
import useAttendancePunch from "./components/attendance/useAttendancePunch";
import useTodayState from "./components/attendance/useTodayState";
import useIsMobile from "../hooks/useIsMobile";

import HeaderCard from "./components/dashboard/HeaderCard";
import DashboardStatCard from "./components/dashboard/DashboardStatCard";
import LeaveBreakdownCard from "./components/dashboard/LeaveBreakdownCard";
import LeaveModal from "./components/dashboard/LeaveModal";
import TodayList from "./components/dashboard/TodayList";
import QuickActions from "./components/dashboard/QuickActions";
import WeeklyHoursMiniChart from "./components/dashboard/WeeklyHoursMiniChart";
import DashboardFab from "./components/dashboard/DashboardFab";

import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: AssignmentOutlined },
    { key: "my-profile", label: "My Profile", icon: PersonOutlined },
    { key: "my-attendance", label: "My Attendance", icon: AccessTimeOutlined },
    { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

const pad = (value) => String(value).padStart(2, "0");

const formatDuration = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
};

function EmployeeDashboard() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [user, setUser] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [elapsed, setElapsed] = useState("00:00:00");
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [applyOpen, setApplyOpen] = useState(false);
    const [toast, setToast] = useState({
        open: false,
        severity: "success",
        message: "",
    });

    const { balance, myLeaves, submitting, applyLeave } = useLeave();

    const {
        state: todayState,
        error: todayStateError,
        now,
        elapsedSeconds,
        refresh: refreshTodayState,
    } = useTodayState();

    const loadSummary = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        setError("");
        try {
            const { data } = await dashboardServ.getSummary();
            setSummary(data);
        } catch (e) {
            setError(e.response?.data?.message || e.message || "Dashboard data could not be loaded. Please refresh and try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch {
            setUser(null);
        }
        loadSummary(true);
    }, [loadSummary]);

    useEffect(() => {
        if (!summary?.checkInTime) {
            setElapsed("00:00:00");
            return undefined;
        }

        const start = new Date(summary.checkInTime).getTime();
        const end = summary.checkOutTime ? new Date(summary.checkOutTime).getTime() : null;

        const tick = () => setElapsed(formatDuration((end ?? Date.now()) - start));
        tick();

        if (end) return undefined;

        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [summary?.checkInTime, summary?.checkOutTime]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch { }
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const todayRecord = useMemo(() => {
        if (todayState?.attendance) {
            return {
                ...todayState.attendance,
                date: todayState.attendanceDate,
            };
        }

        return {
            checkInTime: summary?.checkInTime,
            checkOutTime: summary?.checkOutTime,
        };
    }, [todayState, summary?.checkInTime, summary?.checkOutTime]);

    const displayElapsed = todayState ? formatDuration(elapsedSeconds * 1000) : elapsed;

    const handlePunchSuccess = useCallback(async () => {
        await Promise.all([
            loadSummary(),
            refreshTodayState({ silent: true }),
        ]);
    }, [loadSummary, refreshTodayState]);

    const {
        punch,
        punchLoading,
        punchStage,
        punchError,
        punchWarning,
        clearPunchError,
        clearPunchWarning,
    } = useAttendancePunch({
        todayRecord,
        todayState,
        now,
        onSuccess: handlePunchSuccess,
    });

    const openApplyLeave = useCallback(() => {
        setLeaveOpen(false);
        setApplyOpen(true);
    }, []);

    const handleApplyLeave = useCallback(async (payload) => {
        const created = await applyLeave(payload);
        setApplyOpen(false);
        setToast({
            open: true,
            severity: "success",
            message: "Leave request submitted for approval.",
        });
        return created;
    }, [applyLeave]);

    const displayName = useMemo(() => {
        if (summary?.employee) {
            return [summary.employee.firstName, summary.employee.lastName].filter(Boolean).join(" ") || "Employee";
        }
        if (user) return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee";
        return "Employee";
    }, [summary?.employee, user]);

    const leave = summary?.leave || null;
    const leaveRemaining = Number(leave?.remaining) || 0;
    const presentThisMonth = Number(summary?.presentThisMonth) || 0;
    const hoursThisWeek = Number(summary?.hoursThisWeek) || 0;
    const todayItems = summary?.todayItems || [];
    const weeklyHours = summary?.weeklyHours || [];
    const activeDays = weeklyHours.filter((day) => Number(day.hours) > 0);
    const averageHours = activeDays.length
        ? activeDays.reduce((sum, day) => sum + Number(day.hours), 0) / activeDays.length
        : null;
    const showErrorOnly = !summary && !!error && !loading;

    return (
        <div className="dash-page emp-dashboard emp-home-page">
            <Sidebar
                activeKey="my-dashboard"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                navItems={EMPLOYEE_NAV_ITEMS}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                profilePhotoUrl={summary?.employee?.profilePhotoUrl || null}
            />

            <div className={`dash-main ${sidebarCollapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={user?.role || "EMPLOYEE"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={sidebarCollapsed}
                    onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                    profilePhotoUrl={summary?.employee?.profilePhotoUrl || null}
                />

                <div className="dash-content emp-home-content">
                    {error && summary && (
                        <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setError("")}>
                            {error}
                        </Alert>
                    )}

                    {punchError && (
                        <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }} onClose={clearPunchError}>
                            {punchError}
                        </Alert>
                    )}

                    {punchWarning && (
                        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }} onClose={clearPunchWarning}>
                            {punchWarning}
                        </Alert>
                    )}

                    {showErrorOnly ? (
                        <div className="emp-home-error">
                            <span>{error}</span>
                            <Button variant="contained" onClick={() => loadSummary(true)}>Retry</Button>
                        </div>
                    ) : (
                        <div className="emp-home-widgets">
                            <HeaderCard
                                employee={summary?.employee}
                                status={summary?.status}
                                checkInTime={summary?.checkInTime}
                                checkOutTime={summary?.checkOutTime}
                                locationName={summary?.locationName}
                                elapsed={displayElapsed}
                                isLate={summary?.isLate}
                                todayState={todayState}
                                todayStateError={todayStateError}
                                now={now}
                                greeting={getGreeting()}
                                loading={loading}
                                actionLoading={punchLoading}
                                actionStage={punchStage}
                                onPunch={punch}
                            />

                            <div className="emp-home-stats">
                                <DashboardStatCard
                                    icon={<EventOutlined />}
                                    value={leaveRemaining}
                                    label="Leave days left"
                                    tone="#d97706"
                                    bg="#fffbeb"
                                    loading={loading}
                                    onClick={() => setLeaveOpen(true)}
                                    ariaLabel={`Leave days left: ${leaveRemaining}. View leave balance.`}
                                />
                                <DashboardStatCard
                                    icon={<CheckCircleOutlined />}
                                    value={presentThisMonth}
                                    label="Present this month"
                                    tone="#2563eb"
                                    bg="#eff6ff"
                                    loading={loading}
                                />
                                <DashboardStatCard
                                    icon={<AccessTimeOutlined />}
                                    value={`${hoursThisWeek.toFixed(1)}h`}
                                    label="Hours this week"
                                    tone="#4f46e5"
                                    bg="#eef2ff"
                                    loading={loading}
                                    className="is-hours"
                                />
                                <DashboardStatCard
                                    icon={<TrendingUpOutlined />}
                                    value={averageHours == null ? "—" : `${averageHours.toFixed(1)}h`}
                                    label="Avg hours / day"
                                    tone="#059669"
                                    bg="#ecfdf5"
                                    loading={loading}
                                    className="is-average"
                                />
                            </div>

                            <div className="emp-home-columns">
                                <div className="emp-home-column-main">
                                    <TodayList
                                        items={todayItems}
                                        loading={loading}
                                        onViewAll={() => navigate("/my-attendance")}
                                    />
                                    <WeeklyHoursMiniChart
                                        days={weeklyHours}
                                        total={hoursThisWeek}
                                        loading={loading}
                                    />
                                </div>

                                <aside className="emp-home-column-side" aria-label="Dashboard details">
                                    <LeaveBreakdownCard
                                        leave={leave}
                                        loading={loading}
                                        onOpen={() => setLeaveOpen(true)}
                                    />
                                    <QuickActions
                                        onApplyLeave={openApplyLeave}
                                        onViewPayslips={() => navigate("/my-payslips")}
                                    />
                                </aside>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!showErrorOnly && isMobile && (
                <DashboardFab
                    onApplyLeave={openApplyLeave}
                    onViewPayslips={() => navigate("/my-payslips")}
                />
            )}

            <LeaveModal
                open={leaveOpen}
                onClose={() => setLeaveOpen(false)}
                leave={leave}
                loading={loading}
                onApply={openApplyLeave}
            />

            <ApplyLeaveForm
                open={applyOpen}
                balance={balance}
                existingLeaves={myLeaves}
                submitting={submitting}
                onClose={() => setApplyOpen(false)}
                onSubmit={handleApplyLeave}
            />

            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={() => setToast((previous) => ({ ...previous, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity={toast.severity}
                    variant="filled"
                    onClose={() => setToast((previous) => ({ ...previous, open: false }))}
                    sx={{ borderRadius: 2 }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default EmployeeDashboard;
