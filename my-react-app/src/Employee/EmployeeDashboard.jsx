import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Alert, Button } from "@mui/material";
import {
    PersonOutlined, EventOutlined, AccessTimeOutlined, AssignmentOutlined, PaymentsOutlined,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import dashboardServ from "../services/dashboardService";
import attendanceServ from "../services/attendanceService";
import { getLocation } from "../utils/geolocation";
import useIsMobile from "../hooks/useIsMobile";

import HeaderCard from "./components/dashboard/HeaderCard";
import StatCard from "./components/dashboard/StatCard";
import LeaveModal from "./components/dashboard/LeaveModal";
import TodayList from "./components/dashboard/TodayList";
import BottomNav from "./components/dashboard/BottomNav";
import WorkingHoursChart from "./components/dashboard/WorkingHoursChart";
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

const DEFAULT_WIDGETS = ["headerCard", "stats", "today", "weeklyHours"];

const pad = (value) => String(value).padStart(2, "0");

const formatDuration = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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
    const [actionLoading, setActionLoading] = useState(false);
    const [actionStage, setActionStage] = useState("");
    const [leaveOpen, setLeaveOpen] = useState(false);

    const loadSummary = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        setError("");
        try {
            const { data } = await dashboardServ.getSummary();
            setSummary(data);
        } catch (e) {
            setError(e.response?.data?.message || e.message || "Dashboard data load nahi ho paaya. Please refresh karke try karein.");
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

    const handlePunch = async () => {
        const mode = summary?.checkInTime && !summary?.checkOutTime ? "out" : "in";
        setError("");
        setActionLoading(true);
        setActionStage("locating");
        try {
            const location = await getLocation();
            setActionStage("saving");
            if (mode === "in") {
                await attendanceServ.checkIn(location);
            } else {
                await attendanceServ.checkOut(location);
            }
            await loadSummary();
        } catch (e) {
            setError(e.response?.data?.message || e.message || `${mode === "in" ? "Check-in" : "Check-out"} failed`);
        } finally {
            setActionLoading(false);
            setActionStage("");
        }
    };

    const displayName = useMemo(() => {
        if (summary?.employee) {
            return [summary.employee.firstName, summary.employee.lastName].filter(Boolean).join(" ") || "Employee";
        }
        if (user) return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee";
        return "Employee";
    }, [summary?.employee, user]);

    const leaveRemaining = summary?.leave?.remaining ?? 0;
    const presentThisMonth = summary?.presentThisMonth ?? 0;
    const hoursThisWeek = summary?.hoursThisWeek ?? 0;
    const todayItems = summary?.todayItems || [];
    const weeklyHours = summary?.weeklyHours || [];
    const widgets = summary?.widgets?.length ? summary.widgets : DEFAULT_WIDGETS;

    const widgetRenderers = {
        headerCard: () => (
            <HeaderCard
                employee={summary?.employee}
                status={summary?.status}
                checkInTime={summary?.checkInTime}
                checkOutTime={summary?.checkOutTime}
                locationName={summary?.locationName}
                elapsed={elapsed}
                isLate={summary?.isLate}
                loading={loading}
                actionLoading={actionLoading}
                actionStage={actionStage}
                onPunch={handlePunch}
            />
        ),
        stats: () => (
            <div className="emp-home-stats">
                <StatCard
                    value={leaveRemaining}
                    label="Leave days left"
                    tone="amber"
                    loading={loading}
                    onClick={() => setLeaveOpen(true)}
                    ariaLabel={`Leave days left: ${leaveRemaining}. View leave balance.`}
                />
                <StatCard value={presentThisMonth} label="Present this month" tone="blue" loading={loading} />
                <StatCard value={`${Number(hoursThisWeek).toFixed(1)}h`} label="Hours this week" tone="purple" loading={loading} />
            </div>
        ),
        today: () => (
            <TodayList items={todayItems} loading={loading} onViewAll={() => navigate("/my-attendance")} />
        ),
        weeklyHours: () => (
            <WorkingHoursChart days={weeklyHours} total={hoursThisWeek} loading={loading} />
        ),
    };

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
                    {error && summary && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>{error}</Alert>}

                    {showErrorOnly ? (
                        <div className="emp-home-error">
                            <span>{error}</span>
                            <Button variant="contained" onClick={() => loadSummary(true)}>Retry</Button>
                        </div>
                    ) : (
                        <div className="emp-home-widgets">
                            {widgets.map((widget) => {
                                const render = widgetRenderers[widget];
                                if (!render) return null;
                                return (
                                    <div className={`emp-home-widget is-${widget}`} key={widget}>
                                        {render()}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {isMobile && <BottomNav />}

            {!showErrorOnly && (
                <DashboardFab
                    onApplyLeave={() => navigate("/my-leaves")}
                    onRegularization={() => {}}
                />
            )}

            <LeaveModal
                open={leaveOpen}
                onClose={() => setLeaveOpen(false)}
                leave={summary?.leave}
                loading={loading}
                onApply={() => {
                    setLeaveOpen(false);
                    navigate("/my-leaves");
                }}
            />
        </div>
    );
}

export default EmployeeDashboard;
