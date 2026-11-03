import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Skeleton, Snackbar } from "@mui/material";
import {
    AccessTimeOutlined,
    AddRounded,
    AssignmentOutlined,
    EventOutlined,
    PaymentsOutlined,
    PersonOutlined,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import useIsMobile from "../hooks/useIsMobile";
import { useLeave } from "../context/LeaveContext";
import BottomNav from "./components/dashboard/BottomNav";
import LeaveHeader from "./components/leaves/LeaveHeader";
import BalanceCard from "./components/leaves/BalanceCard";
import UpcomingHolidaysCard from "./components/leaves/UpcomingHolidaysCard";
import StatusSummaryCards from "./components/leaves/StatusSummaryCards";
import LeaveRequestsToolbar from "./components/leaves/LeaveRequestsToolbar";
import LeaveRequestsTable from "./components/leaves/LeaveRequestsTable";
import LeavePagination from "./components/leaves/LeavePagination";
import LeaveRequestCard from "./components/leaves/LeaveRequestCard";
import RequestSheet from "./components/leaves/RequestSheet";
import RequestDetailPanel from "./components/leaves/RequestDetailPanel";
import ApplyLeaveForm from "./components/leaves/ApplyLeaveForm";
import CancelLeaveDialog from "./components/leaves/CancelLeaveDialog";
import {
    balanceTypes,
    formatDate,
    formatRangeShort,
    typeLabel,
} from "./components/leaves/leaveShared";

import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";
import "./EmployeeLeaves.css";

const PAGE_SIZE = 10;

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: AssignmentOutlined },
    { key: "my-profile", label: "My Profile", icon: PersonOutlined },
    { key: "my-attendance", label: "My Attendance", icon: AccessTimeOutlined },
    { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

function EmployeeLeaves() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const {
        myLeaves,
        balance,
        loading,
        submitting,
        error,
        applyLeave,
        cancelLeave,
        reload,
        clearError,
    } = useLeave();

    const [user] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "null");
        } catch {
            return null;
        }
    });
    const [collapsed, setCollapsed] = useState(false);
    const [filter, setFilter] = useState("All");
    const [year, setYear] = useState(() => String(new Date().getFullYear()));
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [applyOpen, setApplyOpen] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

    const types = useMemo(() => balanceTypes(balance), [balance]);

    const yearOptions = useMemo(() => {
        const options = new Set([String(new Date().getFullYear())]);
        myLeaves.forEach((leave) => {
            const leaveYear = String(leave.from || leave.appliedOn || "").slice(0, 4);
            if (/^\d{4}$/.test(leaveYear)) options.add(leaveYear);
        });
        return [...options].sort((a, b) => Number(b) - Number(a));
    }, [myLeaves]);

    const baseLeaves = useMemo(() => {
        const query = search.trim().toLowerCase();

        return myLeaves.filter((leave) => {
            const leaveYear = String(leave.from || leave.appliedOn || "").slice(0, 4);
            if (leaveYear !== String(year)) return false;
            if (!query) return true;

            const haystack = [
                typeLabel(leave.type),
                leave.type,
                leave.from,
                leave.to,
                formatDate(leave.from),
                formatDate(leave.to),
                formatRangeShort(leave.from, leave.to),
            ].join(" ").toLowerCase();

            return haystack.includes(query);
        });
    }, [myLeaves, year, search]);

    const counts = useMemo(() => ({
        All: baseLeaves.length,
        Pending: baseLeaves.filter((leave) => leave.status === "Pending").length,
        Approved: baseLeaves.filter((leave) => leave.status === "Approved").length,
        Rejected: baseLeaves.filter((leave) => leave.status === "Rejected").length,
    }), [baseLeaves]);

    const filteredLeaves = useMemo(() => (
        filter === "All"
            ? baseLeaves
            : baseLeaves.filter((leave) => leave.status === filter)
    ), [baseLeaves, filter]);

    const pageCount = Math.max(1, Math.ceil(filteredLeaves.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pageLeaves = filteredLeaves.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    useEffect(() => {
        setPage(0);
    }, [filter, year, search]);

    const initialError = Boolean(error && !loading && !balance);
    const showInlineError = Boolean(error && balance && !applyOpen);
    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
        : "Employee";
    const emptyMessage = filter === "All"
        ? "Abhi koi leave request nahi."
        : "Is status mein koi request nahi.";

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const openApply = () => {
        if (loading || types.length === 0) return;
        clearError();
        setApplyOpen(true);
    };

    const closeApply = () => {
        if (submitting) return;
        setApplyOpen(false);
        clearError();
    };

    const handleApply = async (payload) => {
        await applyLeave(payload);
        setApplyOpen(false);
        setPage(0);
        clearError();
        setToast({
            open: true,
            severity: "success",
            message: "Request bhej di gayi",
        });
    };

    const handleRequestCancel = (leave) => {
        setSelectedLeave(null);
        setCancelTarget(leave);
    };

    const handleCancel = async () => {
        if (!cancelTarget) return;
        setCancelling(true);
        try {
            await cancelLeave(cancelTarget.id);
            setCancelTarget(null);
            setToast({
                open: true,
                severity: "success",
                message: "Leave request cancel ho gayi.",
            });
        } catch (cancelError) {
            setCancelTarget(null);
            setToast({
                open: true,
                severity: "error",
                message: cancelError?.message || "Leave request cancel nahi ho paayi.",
            });
        } finally {
            setCancelling(false);
        }
    };

    const handleRetry = () => {
        clearError();
        reload();
    };

    const closeToast = () => {
        setToast((previous) => ({ ...previous, open: false }));
    };

    return (
        <div className="dash-page emp-page emp-leave-page">
            <Sidebar
                activeKey="my-leaves"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                navItems={EMPLOYEE_NAV_ITEMS}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed(!collapsed)}
            />

            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={user?.role || "EMPLOYEE"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed(!collapsed)}
                />

                <div className="dash-content emp-leave-content">
                    <div className="emp-leave-shell">
                        <LeaveHeader
                            onApply={openApply}
                            applyDisabled={loading || types.length === 0}
                            showAction={!isMobile}
                        />

                        {initialError ? (
                            <div className="emp-leave-error-card">
                                <p>{error}</p>
                                <Button variant="contained" onClick={handleRetry}>
                                    Retry
                                </Button>
                            </div>
                        ) : (
                            <div className="emp-leave-layout">
                                <div className="emp-leave-left">
                                    <BalanceCard balance={balance} loading={loading} />
                                    <UpcomingHolidaysCard />
                                </div>

                                <div className="emp-leave-main">
                                    {showInlineError && (
                                        <Alert
                                            severity="error"
                                            className="emp-leave-inline-alert"
                                            onClose={clearError}
                                        >
                                            {error}
                                        </Alert>
                                    )}

                                    <StatusSummaryCards
                                        value={filter}
                                        counts={counts}
                                        onChange={setFilter}
                                    />

                                    <LeaveRequestsToolbar
                                        years={yearOptions}
                                        year={year}
                                        onYearChange={setYear}
                                        search={search}
                                        onSearchChange={setSearch}
                                    />

                                    {isMobile ? (
                                        <>
                                            <div className="emp-leave-list" aria-live="polite">
                                                {loading ? (
                                                    [0, 1, 2, 3].map((item) => (
                                                        <div className="emp-leave-request-skeleton" key={item}>
                                                            <Skeleton variant="text" width="52%" height={22} />
                                                            <Skeleton variant="text" width="68%" height={18} />
                                                            <Skeleton variant="rounded" width={72} height={24} />
                                                        </div>
                                                    ))
                                                ) : filteredLeaves.length === 0 ? (
                                                    <p className="emp-leave-empty-text">{emptyMessage}</p>
                                                ) : (
                                                    pageLeaves.map((leave) => (
                                                        <LeaveRequestCard
                                                            key={leave.id}
                                                            leave={leave}
                                                            onSelect={setSelectedLeave}
                                                        />
                                                    ))
                                                )}
                                            </div>

                                            {!loading && (
                                                <LeavePagination
                                                    page={safePage}
                                                    pageCount={pageCount}
                                                    total={filteredLeaves.length}
                                                    pageSize={PAGE_SIZE}
                                                    onChange={setPage}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <LeaveRequestsTable
                                            leaves={pageLeaves}
                                            loading={loading}
                                            total={filteredLeaves.length}
                                            page={safePage}
                                            pageSize={PAGE_SIZE}
                                            pageCount={pageCount}
                                            emptyMessage={emptyMessage}
                                            onPageChange={setPage}
                                            onSelect={setSelectedLeave}
                                            onCancel={handleRequestCancel}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isMobile && <BottomNav />}

            {isMobile && (
                <button
                    type="button"
                    className="emp-leave-apply"
                    onClick={openApply}
                    disabled={loading || types.length === 0}
                    aria-label="Apply for leave"
                >
                    <AddRounded aria-hidden="true" />
                    <span>Apply Leave</span>
                </button>
            )}

            {isMobile ? (
                <RequestSheet
                    open={Boolean(selectedLeave)}
                    leave={selectedLeave}
                    onClose={() => setSelectedLeave(null)}
                    onCancel={handleRequestCancel}
                />
            ) : (
                <RequestDetailPanel
                    open={Boolean(selectedLeave)}
                    leave={selectedLeave}
                    onClose={() => setSelectedLeave(null)}
                    onCancel={handleRequestCancel}
                />
            )}

            <ApplyLeaveForm
                open={applyOpen}
                balance={balance}
                existingLeaves={myLeaves}
                submitting={submitting}
                onClose={closeApply}
                onSubmit={handleApply}
            />

            <CancelLeaveDialog
                open={Boolean(cancelTarget)}
                leave={cancelTarget}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleCancel}
                cancelling={cancelling}
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

export default EmployeeLeaves;
