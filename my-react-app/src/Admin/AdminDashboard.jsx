import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Button } from "@mui/material";
import {
    Add,
    CheckCircle,
    EventBusy,
    Group,
    PersonOff,
} from "@mui/icons-material";

import { auth } from "../firebase";
import adminServ from "../services/adminService";
import dashboardService from "../services/dashboardService";
import useIsMobile from "../hooks/useIsMobile";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

import DashboardStatCard from "../Employee/components/dashboard/DashboardStatCard";

import OwnerBanner from "./components/dashboard/OwnerBanner";
import PendingRequestsCard from "./components/dashboard/PendingRequestsCard";
import AbsentTodayCard from "./components/dashboard/AbsentTodayCard";
import PayrollSummaryCard from "./components/dashboard/PayrollSummaryCard";
import RoleMembersCard from "./components/dashboard/RoleMembersCard";

import "../Employee/EmployeeDashboard.css";
import "./AdminDashboard.css";
import "./components/dashboard/OwnerDashboard.css";

const DEFAULT_WIDGETS = [
    "banner",
    "stats",
    "pendingRequests",
    "absentToday",
    "payroll",
    "membersByRole",
];

const STAT_CARDS = [
    {
        key: "totalEmployees",
        label: "Total Employees",
        icon: <Group />,
        tone: "#4B3FD1",
        bg: "#EEF2FF",
    },
    {
        key: "presentToday",
        label: "Present Today",
        icon: <CheckCircle />,
        tone: "#0B7A55",
        bg: "#E7F7F0",
    },
    {
        key: "onLeaveToday",
        label: "On Leave Today",
        icon: <EventBusy />,
        tone: "#B45309",
        bg: "#FEF3C7",
    },
    {
        key: "absentToday",
        label: "Absent Today",
        icon: <PersonOff />,
        tone: "#B42318",
        bg: "#FEF2F2",
    },
];

function AdminDashboard() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [user, setUser] = useState(null);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        try {
            setUser(JSON.parse(localStorage.getItem("user") || "null"));
        } catch {
            setUser(null);
        }
    }, []);

    const loadDashboard = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError("");

        try {
            const data = await dashboardService.getOwnerOverview();
            setOverview(data);
        } catch (err) {
            console.error("Owner dashboard error:", err);
            setError(
                err?.message ||
                    "Dashboard load nahi ho paya. Please try again."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const handleLogout = async () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        await signOut(auth);
        setUser(null);
        navigate("/login");
    };

    const displayName =
        overview?.name ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Admin";

    const role = String(overview?.role || user?.role || "OWNER").toUpperCase();
    const canManage = role === "OWNER";
    const widgets = overview?.widgets || DEFAULT_WIDGETS;
    const hasWidget = (key) => widgets.includes(key);

    const stats = overview?.stats || {};
    const pendingRequests = overview?.pendingRequests || [];
    const absentToday = overview?.absentToday || [];
    const absentDayOff = Boolean(overview?.absentDayOff);
    const payroll = overview?.payroll || {
        run: null,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        steps: [],
    };
    const members = overview?.members || [];

    const openAddEmployee = () =>
        navigate("/directory", { state: { openAddEmployee: true } });

    const openPending = (request) => {
        if (request?.source === "leave" && request.requestId != null) {
            navigate("/admin/leaves", {
                state: { openLeaveId: request.requestId },
            });
            return;
        }
        navigate("/admin/leaves");
    };

    const handleRefresh = () => {
        if (refreshing) return;
        loadDashboard({ silent: true });
    };

    const renderStats = () => (
        <div className={isMobile ? "owner-mobile-stats" : "owner-stats"}>
            {STAT_CARDS.map((card) => (
                <DashboardStatCard
                    key={card.key}
                    icon={card.icon}
                    label={card.label}
                    value={stats[card.key] ?? "—"}
                    tone={card.tone}
                    bg={card.bg}
                    loading={loading && !overview}
                />
            ))}
        </div>
    );

    const renderDashboard = () => {
        if (error && !overview) {
            return (
                <div className="owner-error" role="alert">
                    <p>{error}</p>
                    <Button type="button" onClick={() => loadDashboard()}>
                        Retry
                    </Button>
                </div>
            );
        }

        if (isMobile) {
            return (
                <div className="owner-mobile">
                    <div className="owner-mobile-title">
                        <h1>Dashboard</h1>
                    </div>

                    {hasWidget("banner") && (
                        <OwnerBanner
                            mobile
                            name={overview?.firstName || displayName.split(" ")[0]}
                            role={role}
                            loading={loading && !overview}
                            onRefresh={handleRefresh}
                            onAddEmployee={openAddEmployee}
                        />
                    )}

                    {hasWidget("stats") && renderStats()}

                    {hasWidget("pendingRequests") && (
                        <PendingRequestsCard
                            items={pendingRequests}
                            loading={loading && !overview}
                            limit={3}
                            onViewAll={() => navigate("/admin/leaves")}
                            onReview={openPending}
                        />
                    )}

                    {hasWidget("payroll") && (
                        <PayrollSummaryCard
                            payroll={payroll}
                            loading={loading && !overview}
                            onOpenPayroll={() => navigate("/payroll")}
                            onRunPayroll={() => navigate("/payroll")}
                        />
                    )}

                    <button
                        type="button"
                        className="owner-fab"
                        aria-label="Add employee"
                        onClick={openAddEmployee}
                    >
                        <Add />
                    </button>
                </div>
            );
        }

        return (
            <div className="owner-dash">
                {hasWidget("banner") && (
                    <OwnerBanner
                        name={displayName}
                        role={role}
                        loading={loading && !overview}
                        refreshing={refreshing || (loading && !overview)}
                        onRefresh={handleRefresh}
                        onAddEmployee={openAddEmployee}
                    />
                )}

                {hasWidget("stats") && renderStats()}

                <div className="owner-columns">
                    <div className="owner-column-main">
                        {hasWidget("pendingRequests") && (
                            <PendingRequestsCard
                                items={pendingRequests}
                                loading={loading && !overview}
                                limit={4}
                                onViewAll={() => navigate("/admin/leaves")}
                                onReview={openPending}
                            />
                        )}

                        {hasWidget("absentToday") && (
                            <AbsentTodayCard
                                items={absentToday}
                                loading={loading && !overview}
                                dayOff={absentDayOff}
                                limit={3}
                                onViewAll={() => navigate("/directory")}
                            />
                        )}
                    </div>

                    <div className="owner-column-side">
                        {hasWidget("payroll") && (
                            <PayrollSummaryCard
                                payroll={payroll}
                                loading={loading && !overview}
                                onOpenPayroll={() => navigate("/payroll")}
                                onRunPayroll={() => navigate("/payroll")}
                            />
                        )}

                        {hasWidget("membersByRole") && (
                            <RoleMembersCard
                                members={members}
                                loading={loading && !overview}
                                canManage={canManage}
                                onManage={() => navigate("/users")}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dash-page owner-dashboard-page">
            <Sidebar
                activeKey="dashboard"
                onLogout={handleLogout}
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((value) => !value)}
            />

            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    search=""
                    onSearchChange={() => {}}
                    userName={displayName}
                    userRole={user?.role || "Administrator"}
                    user={user}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed((value) => !value)}
                    onLogout={handleLogout}
                    onNavigate={(key) => {
                        if (key === "settings") navigate("/settings");
                    }}
                />

                <div className="dash-content">{renderDashboard()}</div>
            </div>
        </div>
    );
}

export default AdminDashboard;
