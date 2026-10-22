import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import {
    Box, Grid, CircularProgress,
    Chip, Button, Alert,
} from "@mui/material";
import {
    PersonOutlined, EventOutlined, PaymentsOutlined, AccessTimeOutlined,
    CheckCircle, RadioButtonUnchecked, AssignmentOutlined, ArrowForward,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import employeeServ from "../services/employeeService";
import attendanceServ from "../services/attendanceService";
import CheckInOut from "../components/CheckInOut";
import LeaveBalanceCard from "./components/LeaveBalanceCard";
import AttendanceSummaryCard from "./components/AttendanceSummaryCard";
import WorkingHoursCard from "./components/WorkingHoursCard";
import AnnouncementsList from "./components/AnnouncementsList";
import HolidaysWidget from "./components/HolidaysWidget";
import ActivityTimeline from "./components/ActivityTimeline";

import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: AssignmentOutlined },
    { key: "my-profile", label: "My Profile", icon: PersonOutlined },
    { key: "my-attendance", label: "My Attendance", icon: AccessTimeOutlined },
    { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

function EmployeeDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [user, setUser] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const [todayAttendance, setTodayAttendance] = useState(null);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch {
            setUser(null);
        }
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            const [empRes, todayRes] = await Promise.allSettled([
                employeeServ.getMe(),
                attendanceServ.getToday(),
            ]);

            if (empRes.status === "fulfilled") {
                setEmployee(empRes.value.data);
                setProfilePhotoUrl(empRes.value.data?.profilePhotoUrl || null);
            }
            if (todayRes.status === "fulfilled") {
                setTodayAttendance(todayRes.value.data);
            }
        } catch (e) {
            setError("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch { }
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const handleNavKey = (e, path) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(path);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
        : "Employee";

    const isProfileComplete = employee?.profileComplete;

    const now = new Date();
    const greeting = now.getHours() < 12
        ? "Good Morning"
        : now.getHours() < 17
            ? "Good Afternoon"
            : "Good Evening";
    const todayDateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
    const checkedIn = !!todayAttendance?.checkInTime;
    const checkedInTime = checkedIn
        ? new Date(todayAttendance.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : null;

    const QUICK_ACTIONS = [
        { label: "Apply Leave", hint: "Casual, Sick & more", icon: EventOutlined, color: "#d97706", bg: "#fffbeb", link: "/my-leaves" },
        { label: "Check Attendance", hint: "Logs & monthly view", icon: AccessTimeOutlined, color: "#6366f1", bg: "#eef2ff", link: "/my-attendance" },
        { label: "My Payslips", hint: "Download payslips", icon: PaymentsOutlined, color: "#059669", bg: "#ecfdf5", link: "/my-payslips" },
        { label: "My Profile", hint: "Edit your details", icon: PersonOutlined, color: "#8b5cf6", bg: "#f5f3ff", link: "/my-profile" },
    ];

    return (

        <div className="dash-page emp-dashboard">
            <Sidebar
                activeKey="my-dashboard"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                navItems={EMPLOYEE_NAV_ITEMS}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                profilePhotoUrl={profilePhotoUrl}
            />


            <div className={`dash-main ${sidebarCollapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={user?.role || "EMPLOYEE"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={sidebarCollapsed}
                    onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                    profilePhotoUrl={profilePhotoUrl}
                />

                <div className="dash-content">
                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                    {/* Hero */}
                    <div className="emp-gradient-header emp-dash-hero">
                        <div className="emp-hero-main">
                            <p className="emp-hero-kicker">{greeting} 👋</p>
                            <h1 className="dash-title">Welcome back!</h1>
                            <p className="dash-subtitle">{todayDateStr} · Here's what's happening today.</p>
                        </div>
                        <div className="emp-hero-side">
                            <div
                                className={`emp-duty-pill ${checkedIn ? "on-duty" : "off-duty"}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate("/my-attendance")}
                                onKeyDown={(e) => handleNavKey(e, "/my-attendance")}
                                aria-label={checkedIn ? `On duty, checked in at ${checkedInTime}. View attendance.` : "Not checked in yet. View attendance."}
                            >
                                <span className="emp-duty-dot" />
                                <span>{checkedIn ? `On duty · ${checkedInTime}` : "Not checked in yet"}</span>
                                <ArrowForward className="emp-duty-arrow" sx={{ fontSize: 15 }} />
                            </div>
                            <div className="emp-header-chips">
                                <Chip
                                    icon={isProfileComplete ? <CheckCircle sx={{ fontSize: 16 }} /> : <RadioButtonUnchecked sx={{ fontSize: 16 }} />}
                                    label={isProfileComplete ? "Profile Complete" : "Profile Pending"}
                                    color={isProfileComplete ? "success" : "warning"}
                                    variant="outlined"
                                    sx={{ fontWeight: 600 }}
                                />
                            </div>
                        </div>
                    </div>

                    {!isProfileComplete && (
                        <Alert
                            severity="warning"
                            sx={{ mb: 3, borderRadius: 2 }}
                            action={
                                <Button color="inherit" size="small" onClick={() => navigate("/my-profile")}
                                    sx={{ textTransform: "none", fontWeight: 600 }}>
                                    Complete Now
                                </Button>
                            }
                        >
                            Your profile is incomplete. Please fill in your Phone, Address, and Emergency Contact.
                        </Alert>
                    )}

                    {/* Quick Actions */}
                    <div className="emp-qa-grid">
                        {QUICK_ACTIONS.map((q) => {
                            const Icon = q.icon;
                            return (
                                <div
                                    key={q.label}
                                    className="emp-qa-tile"
                                    role="button"
                                    tabIndex={0}
                                    style={{ "--qa-accent": q.color }}
                                    onClick={() => navigate(q.link)}
                                    onKeyDown={(e) => handleNavKey(e, q.link)}
                                    aria-label={`${q.label}. ${q.hint}`}
                                >
                                    <span className="emp-qa-icon" style={{ backgroundColor: q.bg, color: q.color }}>
                                        <Icon fontSize="inherit" />
                                    </span>
                                    <span className="emp-qa-text">
                                        <strong>{q.label}</strong>
                                        <small>{q.hint}</small>
                                    </span>
                                    <ArrowForward className="emp-qa-arrow" sx={{ fontSize: 18 }} />
                                </div>
                            );
                        })}
                    </div>

                    {/* Attendance + Leave Balance + Attendance Summary + Working Hours
                        Width CSS grid se aati hai (EmployeeDashboard.css) — MUI ka `size` prop
                        sirf fixed breakpoints deta hai, isliye responsive resize par cards
                        hard jump karte the. `display: flex` ko grid se override kiya gaya hai. */}
                    <Grid container spacing={2} className="emp-stretch-row emp-4col-row" sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}><CheckInOut /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}><LeaveBalanceCard /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}><AttendanceSummaryCard /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}><WorkingHoursCard /></Grid>
                    </Grid>

                    {/* Attendance + Leave Balance + Attendance Summary + Working Hours
                    <div className="emp-auto-grid">
                        <CheckInOut />
                        <LeaveBalanceCard />
                        <AttendanceSummaryCard />
                        <WorkingHoursCard />
                    </div> */}

                    {/* Announcements + Upcoming Holidays */}
                    {/* <Grid container spacing={3} className="emp-stretch-row" sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, md: 6, lg: 3 }}><AnnouncementsList /></Grid>
                        <Grid size={{ xs: 6, md: 6, lg: 3 }}><HolidaysWidget /></Grid>
                    </Grid> */}

                    {/* Recent Activity
                    <Box sx={{ mb: 3 }}>
                        <ActivityTimeline />
                    </Box> */}
                </div>
            </div>
        </div>

    );
}


export default EmployeeDashboard;
