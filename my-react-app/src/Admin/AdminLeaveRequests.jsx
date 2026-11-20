import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
    Alert,
    Checkbox,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    TextField,
} from "@mui/material";
import {
    CancelRounded,
    CheckCircleRounded,
    EventBusyOutlined,
    RefreshRounded,
    VisibilityOutlined,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import "./AdminDashboard.css";
import "./AdminLeaveRequests.css";

import leaveService, { isAdminRole } from "../services/leaveService";
import { useLeave } from "../context/LeaveContext";
import {
    LEAVE_TYPES,
    formatDateTime,
    formatRange,
    typeColor,
} from "../Employee/components/leaves/leaveShared";
import ApproveDialog from "./components/leaves/ApproveDialog";
import RejectDialog from "./components/leaves/RejectDialog";
import LeaveDetailsDrawer from "./components/leaves/LeaveDetailsDrawer";
import {
    CountBadge,
    DataTable,
    EmptyState,
    FilterPills,
    MobileCard,
    MobileCardList,
    PageHeader,
    Pagination,
    RowActions,
    SearchInput,
    StatusBadge,
} from "../components/admin";

const PAGE_SIZE = 10;
const MOBILE_BATCH = 5;

const initialsOf = (name) =>
    (name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");

function AdminLeaveRequests() {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        leaves,
        loading,
        me,
        approveLeave,
        approveMany,
        rejectLeave,
        reload,
    } = useLeave();

    const [user] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "null");
        } catch {
            return null;
        }
    });
    const [collapsed, setCollapsed] = useState(false);
    const [notice, setNotice] = useState(null);

    const [statusFilter, setStatusFilter] = useState("Pending");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [selected, setSelected] = useState([]);

    const [page, setPage] = useState(0);
    const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);

    const [approveTarget, setApproveTarget] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [detailsTarget, setDetailsTarget] = useState(null);
    const [busy, setBusy] = useState(false);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [targetBalance, setTargetBalance] = useState(null);

    const role = user?.role || me?.role;
    const authorized = isAdminRole(role);

    const counts = useMemo(
        () => ({
            All: leaves.length,
            Pending: leaves.filter((leave) => leave.status === "Pending").length,
            Approved: leaves.filter((leave) => leave.status === "Approved").length,
            Rejected: leaves.filter((leave) => leave.status === "Rejected").length,
            Cancelled: leaves.filter((leave) => leave.status === "Cancelled").length,
        }),
        [leaves]
    );

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return leaves
            .filter((leave) => (statusFilter === "All" ? true : leave.status === statusFilter))
            .filter((leave) => (typeFilter ? leave.type === typeFilter : true))
            .filter((leave) => (term ? leave.employeeName.toLowerCase().includes(term) : true))
            .filter((leave) => (from ? leave.to >= from : true))
            .filter((leave) => (to ? leave.from <= to : true));
    }, [leaves, statusFilter, typeFilter, search, from, to]);

    useEffect(() => {
        setSelected((prev) => {
            const visibleIds = new Set(visible.map((leave) => leave.id));
            const next = prev.filter((id) => visibleIds.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [visible]);

    useEffect(() => {
        setPage(0);
        setMobileVisible(MOBILE_BATCH);
    }, [statusFilter, search, typeFilter, from, to]);

    const pendingIds = useMemo(
        () => visible.filter((leave) => leave.status === "Pending").map((leave) => leave.id),
        [visible]
    );

    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.includes(id));
    const someSelected = selected.length > 0 && !allSelected;

    const toggleSelect = (id) =>
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const toggleAll = () => setSelected(allSelected ? [] : pendingIds);

    const openApprove = useCallback(async (leave) => {
        setDetailsTarget(null);
        setApproveTarget(leave);
        setTargetBalance(null);
        try {
            setTargetBalance(await leaveService.getEmployeeBalance(leave.employeeId));
        } catch {
            /* Balance missing ho to dialog block chhupa deta hai. */
        }
    }, []);

    const openReject = useCallback((leave) => {
        setDetailsTarget(null);
        setRejectTarget(leave);
    }, []);

    const openDetails = (leave) => setDetailsTarget(leave);

    const confirmApprove = async (leave) => {
        setBusy(true);
        try {
            const updated = await approveLeave(leave.id);
            setApproveTarget(null);
            setSelected((prev) => prev.filter((id) => id !== leave.id));
            setNotice({
                severity: "success",
                message: `${updated.employeeName}'s ${updated.type} leave (${updated.days}d) approved.`,
            });
        } catch (error) {
            setApproveTarget(null);
            setNotice({ severity: "error", message: error?.message || "Could not approve the request." });
        } finally {
            setBusy(false);
        }
    };

    const confirmReject = async (leave, comment) => {
        setBusy(true);
        try {
            const updated = await rejectLeave(leave.id, comment);
            setRejectTarget(null);
            setSelected((prev) => prev.filter((id) => id !== leave.id));
            setNotice({
                severity: "success",
                message: `${updated.employeeName}'s request rejected and they have been notified.`,
            });
        } catch (error) {
            setRejectTarget(null);
            setNotice({ severity: "error", message: error?.message || "Could not reject the request." });
        } finally {
            setBusy(false);
        }
    };

    const confirmBulkApprove = async () => {
        const ids = [...selected];
        if (ids.length === 0) return;
        setBulkBusy(true);
        try {
            const done = await approveMany(ids);
            setSelected([]);
            setNotice({
                severity: "success",
                message: `${done.length} leave ${done.length === 1 ? "request" : "requests"} approved.`,
            });
        } catch (error) {
            setNotice({ severity: "error", message: error?.message || "Bulk approval failed." });
        } finally {
            setBulkBusy(false);
        }
    };

    useEffect(() => {
        const targetId = location.state?.openLeaveId;
        if (targetId == null || leaves.length === 0) return;

        const leave = leaves.find((item) => String(item.id) === String(targetId));
        if (!leave) return;

        setStatusFilter("All");
        setDetailsTarget(leave);
        navigate(location.pathname, { replace: true, state: null });
    }, [location.state, location.pathname, leaves, navigate]);

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Administrator"
        : me?.name || "Administrator";

    const hasFilters = Boolean(search || typeFilter || from || to || statusFilter !== "All");

    const resetFilters = () => {
        setStatusFilter("All");
        setSearch("");
        setTypeFilter("");
        setFrom("");
        setTo("");
    };

    const guard = (fn) => (event) => {
        event?.stopPropagation?.();
        fn();
    };

    const rowActions = (leave) => {
        const actions = [
            {
                key: "view",
                label: "View details",
                ariaLabel: `View ${leave.employeeName}'s leave request`,
                icon: VisibilityOutlined,
                onClick: guard(() => openDetails(leave)),
            },
        ];

        if (leave.status === "Pending") {
            actions.push({
                key: "approve",
                label: "Approve",
                ariaLabel: `Approve ${leave.employeeName}'s ${leave.type} leave`,
                icon: CheckCircleRounded,
                onClick: guard(() => openApprove(leave)),
            });
            actions.push({
                key: "reject",
                label: "Reject",
                ariaLabel: `Reject ${leave.employeeName}'s ${leave.type} leave`,
                icon: CancelRounded,
                tone: "danger",
                onClick: guard(() => openReject(leave)),
            });
        }

        return actions;
    };

    const columns = [
        {
            key: "select",
            header: (
                <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={toggleAll}
                    disabled={pendingIds.length === 0}
                    inputProps={{ "aria-label": "Select all pending leave requests" }}
                />
            ),
            align: "center",
            width: 52,
            render: (leave) => (
                <span onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                        size="small"
                        checked={selected.includes(leave.id)}
                        disabled={leave.status !== "Pending"}
                        onChange={() => toggleSelect(leave.id)}
                        inputProps={{ "aria-label": `Select leave request from ${leave.employeeName}` }}
                    />
                </span>
            ),
        },
        {
            key: "employee",
            header: "Employee",
            render: (leave) => (
                <span className="adm-leave-person">
                    <span className="adm-leave-avatar" aria-hidden="true">
                        {initialsOf(leave.employeeName)}
                    </span>
                    <span className="adm-leave-person-copy">
                        <span className="admin-cell-primary">{leave.employeeName}</span>
                        <span className="admin-cell-sub">
                            {[leave.departmentName, leave.designationTitle].filter(Boolean).join(" · ") ||
                                leave.employeeCode ||
                                "—"}
                        </span>
                    </span>
                </span>
            ),
        },
        {
            key: "type",
            header: "Type",
            render: (leave) => (
                <span className="adm-leave-type">
                    <span
                        className="adm-leave-dot"
                        style={{ background: typeColor(leave.type) }}
                        aria-hidden="true"
                    />
                    {leave.type}
                </span>
            ),
        },
        {
            key: "dates",
            header: "Dates",
            render: (leave) => <span className="adm-leave-range-primary">{formatRange(leave.from, leave.to)}</span>,
        },
        {
            key: "days",
            header: "Days",
            align: "center",
            render: (leave) => (
                <CountBadge value={leave.days} label={leave.days === 1 ? "day" : "days"} />
            ),
        },
        {
            key: "applied",
            header: "Applied",
            render: (leave) => <span className="adm-leave-muted">{formatDateTime(leave.appliedOn)}</span>,
        },
        {
            key: "status",
            header: "Status",
            render: (leave) => <StatusBadge status={leave.status} />,
        },
        {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (leave) => <RowActions actions={rowActions(leave)} />,
        },
    ];

    const emptyState = (
        <EmptyState
            icon={<EventBusyOutlined />}
            title={hasFilters ? "No leave requests match these filters." : "No leave requests to review."}
            subtitle={
                hasFilters
                    ? "Try a different status, name, type or date range."
                    : "New requests will appear here as soon as employees apply."
            }
            action={
                hasFilters ? (
                    <button type="button" className="admin-btn is-ghost-dark" onClick={resetFilters}>
                        Reset filters
                    </button>
                ) : null
            }
        />
    );

    const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pagedLeaves = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const mobileLeaves = visible.slice(0, mobileVisible);

    if (!authorized) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="dash-page admin-page-shell">
            <Sidebar
                activeKey="leaves"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed(!collapsed)}
            />
            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={role || "OWNER"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed(!collapsed)}
                />

                <div className="dash-content">
                    <div className="admin-page">
                        <PageHeader
                            title="Leave Requests"
                            subtitle="Review, approve and track employee leave requests"
                            actions={[
                                {
                                    key: "refresh",
                                    label: "Refresh",
                                    icon: RefreshRounded,
                                    variant: "primary",
                                    onClick: reload,
                                },
                            ]}
                        />

                        <div className="admin-toolbar">
                            <div className="admin-toolbar-left">
                                <SearchInput
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Search by employee name..."
                                    ariaLabel="Search leave requests"
                                />

                                <FormControl size="small" sx={{ minWidth: 160 }}>
                                    <InputLabel id="admin-leave-type-filter">Leave type</InputLabel>
                                    <Select
                                        labelId="admin-leave-type-filter"
                                        label="Leave type"
                                        value={typeFilter}
                                        onChange={(event) => setTypeFilter(event.target.value)}
                                    >
                                        <MenuItem value="">All types</MenuItem>
                                        {LEAVE_TYPES.map((type) => (
                                            <MenuItem key={type} value={type}>
                                                {type}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <div className="adm-leave-date-range">
                                    <TextField
                                        label="From"
                                        type="date"
                                        size="small"
                                        value={from}
                                        onChange={(event) => setFrom(event.target.value)}
                                        slotProps={{
                                            inputLabel: { shrink: true },
                                            htmlInput: { max: to || undefined },
                                        }}
                                    />
                                    <TextField
                                        label="To"
                                        type="date"
                                        size="small"
                                        value={to}
                                        onChange={(event) => setTo(event.target.value)}
                                        slotProps={{
                                            inputLabel: { shrink: true },
                                            htmlInput: { min: from || undefined },
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="admin-toolbar-right">
                                <FilterPills
                                    ariaLabel="Filter leave requests by status"
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={[
                                        { key: "All", label: "All", count: counts.All },
                                        { key: "Pending", label: "Pending", count: counts.Pending },
                                        { key: "Approved", label: "Approved", count: counts.Approved },
                                        { key: "Rejected", label: "Rejected", count: counts.Rejected },
                                        { key: "Cancelled", label: "Cancelled", count: counts.Cancelled },
                                    ]}
                                />
                            </div>
                        </div>

                        {selected.length > 0 && (
                            <div className="adm-leave-selection">
                                <span>
                                    {selected.length} {selected.length === 1 ? "request" : "requests"} selected
                                </span>
                                <div className="adm-leave-selection-actions">
                                    <button
                                        type="button"
                                        className="admin-btn is-ghost-dark"
                                        onClick={() => setSelected([])}
                                        disabled={bulkBusy}
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        className="admin-btn is-primary-solid"
                                        onClick={confirmBulkApprove}
                                        disabled={bulkBusy}
                                    >
                                        {bulkBusy ? "Approving…" : "Approve selected"}
                                    </button>
                                </div>
                            </div>
                        )}

                        <DataTable
                            ariaLabel="Leave requests"
                            columns={columns}
                            rows={pagedLeaves}
                            rowKey="id"
                            loading={loading}
                            skeletonRows={PAGE_SIZE}
                            empty={emptyState}
                            onRowClick={(leave) => openDetails(leave)}
                        />

                        <Pagination
                            page={safePage}
                            pageSize={PAGE_SIZE}
                            total={visible.length}
                            onPageChange={setPage}
                        />

                        <MobileCardList
                            items={mobileLeaves}
                            loading={loading}
                            getKey={(leave) => leave.id}
                            hasMore={visible.length > mobileVisible}
                            onLoadMore={() => setMobileVisible((prev) => prev + MOBILE_BATCH)}
                            empty={emptyState}
                            renderItem={(leave) => (
                                <MobileCard
                                    title={leave.employeeName}
                                    subtitle={leave.reason || "No reason provided"}
                                    badge={<StatusBadge status={leave.status} />}
                                    fields={[
                                        { label: "Type", value: leave.type },
                                        { label: "Dates", value: formatRange(leave.from, leave.to) },
                                        {
                                            label: "Days",
                                            value: `${leave.days} ${leave.days === 1 ? "day" : "days"}`,
                                        },
                                        { label: "Applied", value: formatDateTime(leave.appliedOn) },
                                    ]}
                                    actions={rowActions(leave)}
                                    ariaLabel={`${leave.employeeName}'s ${leave.type} leave request`}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>

            <ApproveDialog
                open={!!approveTarget}
                leave={approveTarget}
                employeeBalance={targetBalance}
                onClose={() => setApproveTarget(null)}
                onConfirm={() => confirmApprove(approveTarget)}
                approving={busy}
            />

            <RejectDialog
                open={!!rejectTarget}
                leave={rejectTarget}
                onClose={() => setRejectTarget(null)}
                onConfirm={(comment) => confirmReject(rejectTarget, comment)}
                rejecting={busy}
            />

            <LeaveDetailsDrawer
                open={!!detailsTarget}
                leave={detailsTarget}
                onClose={() => setDetailsTarget(null)}
                onApprove={() => openApprove(detailsTarget)}
                onReject={() => openReject(detailsTarget)}
            />

            <Snackbar
                open={!!notice}
                autoHideDuration={4000}
                onClose={() => setNotice(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setNotice(null)}
                    severity={notice?.severity || "success"}
                    sx={{ width: "100%", borderRadius: 2.5 }}
                >
                    {notice?.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default AdminLeaveRequests;
