import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Skeleton,
    Snackbar,
    Typography,
} from "@mui/material";
import {
    CheckCircleRounded,
    CloseRounded,
    EventBusyOutlined,
    RefreshRounded,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import "./AdminDashboard.css";
import "./AdminLeaveRequests.css";

import leaveService, { isAdminRole, toISODate } from "../services/leaveService";
import { useLeave } from "../context/LeaveContext";
import PageHeroBanner from "../Employee/components/PageHeroBanner";
import { CARD_SX, INDIGO } from "../Employee/components/leaves/leaveShared";
import AdminLeaveStatCards from "./components/leaves/AdminLeaveStatCards";
import AdminLeaveFilters from "./components/leaves/AdminLeaveFilters";
import LeaveRequestTable from "./components/leaves/LeaveRequestTable";
import LeaveRequestCardList from "./components/leaves/LeaveRequestCardList";
import ApproveDialog from "./components/leaves/ApproveDialog";
import RejectDialog from "./components/leaves/RejectDialog";
import LeaveDetailsDrawer from "./components/leaves/LeaveDetailsDrawer";

/* ---- List skeleton (loading state) ------------------------------------ */
function RequestSkeleton() {
    return (
        <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton width="20%" height={20} />
                    <Skeleton width="16%" height={20} />
                    <Skeleton width="30%" height={20} sx={{ display: { xs: "none", md: "block" } }} />
                    <Skeleton variant="rounded" width={70} height={26} sx={{ ml: "auto !important" }} />
                </Box>
            ))}
        </Box>
    );
}

function EmptyRequests({ onReset, hasFilters }) {
    return (
        <Box sx={{ py: { xs: 5, md: 7 }, px: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "#f4f5fb",
                    border: "1px dashed #d7dbe8",
                    color: "#b6bcd0",
                    mb: 0.5,
                }}
            >
                <EventBusyOutlined sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
                No leave requests found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 340 }}>
                {hasFilters
                    ? "Nothing matches the current filters. Try a different status, name, type or date range."
                    : "There are no leave requests to review right now."}
            </Typography>
            {hasFilters && (
                <Button
                    variant="outlined"
                    onClick={onReset}
                    sx={{
                        mt: 1,
                        minHeight: 42,
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 2.5,
                        px: 2.5,
                        color: INDIGO,
                        borderColor: "#d7d9f7",
                        "&:hover": { bgcolor: "#f4f2ff", borderColor: INDIGO },
                    }}
                >
                    Reset filters
                </Button>
            )}
        </Box>
    );
}

function AdminLeaveRequests() {
    const navigate = useNavigate();

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
    const [notice, setNotice] = useState(null); // { severity, message }

    /* ---- Filters (saare list ke upar, list se pehle) ---- */
    const [statusFilter, setStatusFilter] = useState("Pending"); // default: Pending
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [selected, setSelected] = useState([]); // bulk approve ke liye

    /* ---- Dialog / drawer state ---- */
    const [approveTarget, setApproveTarget] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [detailsTarget, setDetailsTarget] = useState(null);
    const [busy, setBusy] = useState(false); // approve/reject in-flight
    const [bulkBusy, setBulkBusy] = useState(false);
    const [targetBalance, setTargetBalance] = useState(null);

    /* Role guard. Route par bhi `RequireAuth` hai — ye defense in depth hai,
       taaki koi galti se page render ho jaaye to bhi data leak na ho.

       NOTE: guard ka `return` saare hooks ke BAAD aana zaroori hai, warna
       role change par hooks ka order badal jaata hai (rules-of-hooks
       error) — isliye yahan sirf flag set hota hai, redirect neeche hota
       hai. */
    const role = user?.role || me?.role;
    const authorized = isAdminRole(role);

    /* ---- Counts (POORI list se, filters se nahi) -------------------------
       Stat cards hamesha "sab employees ke across" numbers dikhate hain,
       isiliye ye `leaves` se bante hain, filtered list se nahi. */
    const today = toISODate(new Date());

    const counts = useMemo(
        () => ({
            All: leaves.length,
            Pending: leaves.filter((l) => l.status === "Pending").length,
            Approved: leaves.filter((l) => l.status === "Approved").length,
            Rejected: leaves.filter((l) => l.status === "Rejected").length,
            Cancelled: leaves.filter((l) => l.status === "Cancelled").length,
        }),
        [leaves]
    );

    /* "On Leave Today" — approved leave jisme aaj aa raha hai, employees
       ki sankhya (requests ki nahi). Ek employee do alag approved leaves
       me ho to bhi ek hi baar count hota hai. */
    const onLeaveToday = useMemo(() => {
        const ids = new Set();
        leaves.forEach((l) => {
            if (l.status === "Approved" && l.from <= today && today <= l.to) ids.add(l.employeeId);
        });
        return ids.size;
    }, [leaves, today]);

    const stats = useMemo(
        () => ({
            pending: counts.Pending,
            approved: counts.Approved,
            rejected: counts.Rejected,
            onLeaveToday,
        }),
        [counts, onLeaveToday]
    );

    /* ---- Filtered list -------------------------------------------------- */
    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return leaves
            .filter((l) => (statusFilter === "All" ? true : l.status === statusFilter))
            .filter((l) => (typeFilter ? l.type === typeFilter : true))
            .filter((l) => (term ? l.employeeName.toLowerCase().includes(term) : true))
            /* Date range `from`/`to` par leave ka span filter hota hai. */
            .filter((l) => (from ? l.to >= from : true))
            .filter((l) => (to ? l.from <= to : true));
    }, [leaves, statusFilter, typeFilter, search, from, to]);

    /* Filter change hone par purani selection stale ho jaati hai — un
       records ki ab shayad list me bhi nahi. */
    useEffect(() => {
        setSelected((prev) => {
            const visibleIds = new Set(visible.map((l) => l.id));
            const next = prev.filter((id) => visibleIds.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [visible]);

    const hasFilters = !!(search || typeFilter || from || to || (statusFilter && statusFilter !== "All"));

    const resetFilters = () => {
        setStatusFilter("All");
        setSearch("");
        setTypeFilter("");
        setFrom("");
        setTo("");
    };

    /* ---- Selection (bulk approve ke liye) ------------------------------- */
    const pendingIds = useMemo(
        () => visible.filter((l) => l.status === "Pending").map((l) => l.id),
        [visible]
    );

    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.includes(id));
    const someSelected = selected.length > 0 && !allSelected;

    const toggleSelect = (id) =>
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const toggleAll = () => setSelected(allSelected ? [] : pendingIds);

    /* ---- Actions --------------------------------------------------------- */

    /* Approve dialog me us employee ka CURRENT balance dikhate hain, taaki
       admin approve se pehle dekh le ki kitna bachega. */
    const openApprove = useCallback(async (leave) => {
        setDetailsTarget(null);
        setApproveTarget(leave);
        setTargetBalance(null);
        try {
            setTargetBalance(await leaveService.getEmployeeBalance(leave.employeeId));
        } catch {
            /* Balance na mile to dialog balance block chhupa dega — approve
               phir bhi kaam karega. */
        }
    }, []);

    const openReject = useCallback((leave) => {
        setDetailsTarget(null);
        setRejectTarget(leave);
    }, []);

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
        } catch (e) {
            setApproveTarget(null);
            setNotice({ severity: "error", message: e?.message || "Could not approve the request." });
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
        } catch (e) {
            setRejectTarget(null);
            setNotice({ severity: "error", message: e?.message || "Could not reject the request." });
        } finally {
            setBusy(false);
        }
    };

    /* Bulk approve — ek-ek karke, isliye server ka status-guard har record
       par lagta hai. Ek fail ho to baaki bhi approve nahi honge (error
       Snackbar me dikhta hai). */
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
        } catch (e) {
            setNotice({ severity: "error", message: e?.message || "Bulk approval failed." });
        } finally {
            setBulkBusy(false);
        }
    };

    /* ---- Drawer --------------------------------------------------------- */
    const openDetails = (leave) => setDetailsTarget(leave);

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Administrator"
        : me?.name || "Administrator";

    /* Stat card click = us status ka filter. "On Leave Today" card par koi
       filter nahi (wo ek count hai, status nahi). */
    const handleStatSelect = (key) => {
        if (key === "onLeaveToday") return;
        setStatusFilter((prev) => (prev === key ? "All" : key));
    };

    const activeStatKey = statusFilter === "All" ? null : statusFilter.toLowerCase();

    const periodLabel = useMemo(
        () => new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        []
    );

    if (!authorized) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="dash-page emp-page">
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
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search employees..."
                />

                <div className="dash-content">
                    <Box className="emp-leave-page">
                        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                            {/* ---- Page hero: same component as My Leaves, isiliye
                                dono pages visually ek jaise lagte hain. ---- */}
                            <PageHeroBanner
                                title="Leave Requests"
                                subtitle="Review and approve employee leaves"
                                chips={[
                                    { label: periodLabel, variant: "outlined" },
                                    { label: `${counts.Pending} pending`, variant: "outlined", color: "warning" },
                                    { label: "Demo data", variant: "outlined", color: "warning" },
                                ]}
                                action={
                                    <Button
                                        variant="contained"
                                        startIcon={<RefreshRounded />}
                                        onClick={reload}
                                        sx={{
                                            bgcolor: "#ffffff",
                                            color: INDIGO,
                                            minHeight: 44,
                                            whiteSpace: "nowrap",
                                            fontWeight: 700,
                                            textTransform: "none",
                                            borderRadius: 2.5,
                                            px: 2.5,
                                            boxShadow: "0 8px 20px -8px rgba(79,70,229,0.55)",
                                            "&:hover": { bgcolor: "#f4f2ff", transform: "translateY(-1px)" },
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                }
                            />

                            {/* ---- Stat cards ---- */}
                            <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
                                <AdminLeaveStatCards
                                    stats={stats}
                                    loading={loading}
                                    activeKey={activeStatKey}
                                    onSelect={handleStatSelect}
                                />
                            </Box>

                            {/* ---- Requests list ---- */}
                            <Card sx={{ ...CARD_SX, overflow: "hidden" }}>
                                <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                                    {/* Card head — title + count + bulk action */}
                                    <Box
                                        sx={{
                                            px: { xs: 2, md: 2.5 },
                                            pt: 2,
                                            pb: 1.5,
                                            display: "flex",
                                            flexWrap: "wrap",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 1.25,
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography
                                                variant="h6"
                                                sx={{ fontWeight: 800, color: "text.primary", fontSize: { xs: 16.5, md: 18 } }}
                                            >
                                                {statusFilter === "All" ? "All requests" : `${statusFilter} requests`}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {loading
                                                    ? "Loading…"
                                                    : `${visible.length} of ${leaves.length} shown`}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                                            {/* Selected count — tab dikhta hai jab
                                                kuch select ho. */}
                                            {selected.length > 0 && (
                                                <Chip
                                                    label={`${selected.length} selected`}
                                                    size="small"
                                                    onDelete={() => setSelected([])}
                                                    deleteIcon={<CloseRounded sx={{ fontSize: 15 }} />}
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: 12,
                                                        bgcolor: "#eef0ff",
                                                        color: INDIGO,
                                                        height: 34,
                                                    }}
                                                />
                                            )}

                                            <Button
                                                variant="contained"
                                                color="success"
                                                startIcon={<CheckCircleRounded sx={{ fontSize: "18px !important" }} />}
                                                onClick={confirmBulkApprove}
                                                disabled={selected.length === 0 || bulkBusy}
                                                sx={{
                                                    textTransform: "none",
                                                    fontWeight: 700,
                                                    minHeight: 38,
                                                    fontSize: 13,
                                                    borderRadius: 2.5,
                                                    px: 1.75,
                                                    boxShadow: selected.length
                                                        ? "0 8px 20px -8px rgba(5,150,105,0.6)"
                                                        : "none",
                                                }}
                                            >
                                                {bulkBusy ? "Approving…" : "Approve selected"}
                                            </Button>
                                        </Box>
                                    </Box>

                                    <AdminLeaveFilters
                                        status={statusFilter}
                                        onStatusChange={setStatusFilter}
                                        counts={counts}
                                        search={search}
                                        onSearchChange={setSearch}
                                        type={typeFilter}
                                        onTypeChange={setTypeFilter}
                                        from={from}
                                        to={to}
                                        onRangeChange={(f, t) => {
                                            setFrom(f);
                                            setTo(t);
                                        }}
                                    />

                                    <Divider />

                                    {loading ? (
                                        <RequestSkeleton />
                                    ) : visible.length === 0 ? (
                                        <EmptyRequests onReset={resetFilters} hasFilters={hasFilters} />
                                    ) : (
                                        <>
                                            <LeaveRequestTable
                                                leaves={visible}
                                                selected={selected}
                                                onToggleSelect={toggleSelect}
                                                onToggleAll={toggleAll}
                                                onOpenDetails={openDetails}
                                                onApprove={openApprove}
                                                onReject={openReject}
                                                allSelected={allSelected}
                                                someSelected={someSelected}
                                            />
                                            <LeaveRequestCardList
                                                leaves={visible}
                                                selected={selected}
                                                onToggleSelect={toggleSelect}
                                                onOpenDetails={openDetails}
                                                onApprove={openApprove}
                                                onReject={openReject}
                                            />
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </Container>
                    </Box>
                </div>
            </div>

            {/* ---- Dialogs & drawer ---- */}
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

            {/* ---- Snackbar ---- */}
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
