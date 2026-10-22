import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Container,
    Grid,
    Snackbar,
} from "@mui/material";
import { AddRounded, EventOutlined } from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import "../Admin/AdminDashboard.css";
import "./EmployeeLeaves.css";

import { useLeave } from "../context/LeaveContext";
import PageHeroBanner from "./components/PageHeroBanner";
import LeaveStatCards from "./components/leaves/LeaveStatCards";
import LeaveBalanceCard from "./components/leaves/LeaveBalanceCard";
import MonthlyRequestsChart from "./components/leaves/MonthlyRequestsChart";
import LeaveHistory, { HISTORY_ANCHOR_ID } from "./components/leaves/LeaveHistory";
import ApplyLeaveDialog from "./components/leaves/ApplyLeaveDialog";
import CancelLeaveDialog from "./components/leaves/CancelLeaveDialog";
import { INDIGO } from "./components/leaves/leaveShared";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: EventOutlined },
    { key: "my-profile", label: "My Profile", icon: EventOutlined },
    { key: "my-attendance", label: "My Attendance", icon: EventOutlined },
    { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
    { key: "my-payslips", label: "My Payslips", icon: EventOutlined },
];

function EmployeeLeaves() {
    const navigate = useNavigate();

    /* Saara data shared store se — isiliye admin approval / cancel ke baad
       is page ke numbers (stat cards, chart, balance) turant change hote
       hain, chahe page reload na ho. */
    const {
        myLeaves,
        balance,
        loading,
        submitting,
        error,
        me,
        applyLeave,
        cancelLeave,
        clearError,
    } = useLeave();

    /* Login ke baad `user` localStorage me hota hai — pehle render hi
       sahi ho, isliye lazy initializer (useEffect me set karte to sidebar
       ek render khali dikhta). */
    const [user] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "null");
        } catch {
            return null;
        }
    });
    const [collapsed, setCollapsed] = useState(false);
    const [notice, setNotice] = useState("");
    const [applyOpen, setApplyOpen] = useState(false);
    /* Cancel confirm dialog ka state — `cancelTarget` = jis record ke liye
       user ne "Cancel" dabaya. */
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    /* History ka filter page ke upar — taaki stat cards aur filter chips
       ek hi state ko control karein (card click = chip select). */
    const [historyFilter, setHistoryFilter] = useState("All");

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    /* Stat card click → wahi filter history table par laga do, aur user ko
       list tak le jao (table page ke neeche hoti hai). "Total" ka matlab
       koi filter nahi = All. */
    const handleStatSelect = (statKey) => {
        const next = statKey === "total" ? "All" : `${statKey[0].toUpperCase()}${statKey.slice(1)}`;
        setHistoryFilter(next);
        const anchor = document.getElementById(HISTORY_ANCHOR_ID);
        if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleApply = async (payload) => {
        try {
            await applyLeave(payload);
            /* Context ne record list + notifications turant patch kar diye
               hain — isiliye yahan koi refetch nahi, list/stat/chart isi
               frame me update ho jaate hain. */
            setApplyOpen(false);
            setNotice("Leave request submitted — waiting for approval.");
        } catch {
            /* `error` context me chala gaya; page ka Alert dikha dega aur
               dialog khula rahega taaki user apna form na bhare. */
        }
    };

    const handleCancel = useCallback(
        async (leave) => {
            setCancelling(true);
            try {
                const updated = await cancelLeave(leave.id);
                setCancelTarget(null);
                setNotice(`${updated.type} leave request cancelled.`);
            } catch (e) {
                setCancelTarget(null);
                setNotice(e?.message || "Could not cancel the leave request.");
            } finally {
                setCancelling(false);
            }
        },
        [cancelLeave]
    );

    const stats = useMemo(
        () => ({
            total: myLeaves.length,
            approved: myLeaves.filter((l) => l.status === "Approved").length,
            pending: myLeaves.filter((l) => l.status === "Pending").length,
            rejected: myLeaves.filter((l) => l.status === "Rejected").length,
        }),
        [myLeaves]
    );

    /* Pending days abhi balance me katte nahi (approval ka wait), isliye
       balance card ke footer me yahi count dikhaya jaata hai. */
    const pendingDays = useMemo(
        () => myLeaves.filter((l) => l.status === "Pending").reduce((sum, l) => sum + (l.days || 0), 0),
        [myLeaves]
    );

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
        : me?.name || "Employee";

    /* Banner ka month chip — chart aur history dono 6 mahine (including
       current month) dikhate hain, to chip bhi wahi period bataati hai. */
    const periodLabel = useMemo(
        () =>
            new Date().toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric",
            }),
        []
    );

    return (
        <div className="dash-page emp-page">
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

                <div className="dash-content">
                    <Box className="emp-leave-page">
                        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                            {/* ---- Page hero (shared with My Attendance) -------------
                                Title, subtitle aur "Last 6 months" chips dono pages
                                par ek jaise hain; "Apply Leave" button banner ke
                                action slot me hai, isliye alag header ki zaroorat
                                nahi. */}
                            <PageHeroBanner
                                title="My Leaves"
                                subtitle="Apply for leave and track your requests"
                                chips={[
                                    { label: "Last 6 months", variant: "text" },
                                    { label: periodLabel, variant: "outlined" },
                                    { label: "Demo data", variant: "outlined", color: "warning" },
                                ]}
                                action={
                                    <Button
                                        variant="contained"
                                        startIcon={<AddRounded />}
                                        onClick={() => setApplyOpen(true)}
                                        sx={{
                                            /* Gradient ke upar white surface + indigo
                                               text: white chips ke saath bhi match
                                               karta hai aur action turant dikhta hai. */
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
                                        Apply Leave
                                    </Button>
                                }
                            />

                            {error && (
                                <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5 }} onClose={clearError}>
                                    {error}
                                </Alert>
                            )}

                            {/* ---- Top section ---------------------------------
                                Desktop (md+):
                                  Row 1 → 4 stat cards, poori width (12/12)
                                  Row 2 → Monthly Requests chart (8/12) +
                                          Leave Balance (4/12), ek hi row me

                                Ab kisi Grid item par `gridRow`/`gridColumn`
                                nahi hai — teeno normal auto-placement se
                                baithte hain, isliye koi row/column override
                                se ladai nahi hoti.

                                Mobile (xs): teeno full width. `order` sirf xs
                                par lagta hai (balance chart se pehle), taaki
                                stack order stats (2x2) → balance → chart
                                bana rahe. */}
                            <Grid container spacing={2} alignItems="stretch">
                                {/* Row 1 — stat cards, poori width (clickable filters) */}
                                <Grid size={{ xs: 12, md: 12 }}>
                                    <LeaveStatCards
                                        stats={stats}
                                        loading={loading}
                                        activeKey={historyFilter === "All" ? "total" : historyFilter.toLowerCase()}
                                        onSelect={handleStatSelect}
                                    />
                                </Grid>

                                {/* Row 2, left — Monthly Requests chart */}
                                <Grid size={{ xs: 12, md: 8 }} sx={{ order: { xs: 2, md: 0 } }}>
                                    <MonthlyRequestsChart leaves={myLeaves} loading={loading} />
                                </Grid>

                                {/* Row 2, right — Leave Balance */}
                                <Grid size={{ xs: 12, md: 4 }} sx={{ order: { xs: 1, md: 0 } }}>
                                    <LeaveBalanceCard balance={balance} loading={loading} pendingDays={pendingDays} />
                                </Grid>
                            </Grid>

                            <LeaveHistory
                                leaves={myLeaves}
                                loading={loading}
                                filter={historyFilter}
                                onFilterChange={setHistoryFilter}
                                onApply={() => setApplyOpen(true)}
                                onCancel={setCancelTarget}
                            />
                        </Container>
                    </Box>
                </div>
            </div>

            <ApplyLeaveDialog
                open={applyOpen}
                onClose={() => setApplyOpen(false)}
                onSubmit={handleApply}
                submitting={submitting}
                balance={balance}
                leaves={myLeaves}
            />

            <CancelLeaveDialog
                open={!!cancelTarget}
                leave={cancelTarget}
                onClose={() => setCancelTarget(null)}
                onConfirm={() => handleCancel(cancelTarget)}
                cancelling={cancelling}
            />

            <Snackbar
                open={!!notice}
                autoHideDuration={4000}
                onClose={() => setNotice("")}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert onClose={() => setNotice("")} severity="success" sx={{ width: "100%", borderRadius: 2.5 }}>
                    {notice}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default EmployeeLeaves;
