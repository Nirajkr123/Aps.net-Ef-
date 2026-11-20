import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
    Alert,
    Button,
    CircularProgress,
    Skeleton,
    Snackbar,
} from "@mui/material";
import {
    LaptopMacOutlined,
    RefreshRounded,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import ConfirmModal from "../components/admin/ConfirmModal";
import PayrollHeader from "./components/payroll/PayrollHeader";
import PayrollStepper from "./components/payroll/PayrollStepper";
import SummaryCards from "./components/payroll/SummaryCards";
import PayslipReviewTable from "./components/payroll/PayslipReviewTable";
import AdjustmentDrawer from "./components/payroll/AdjustmentDrawer";
import PublishConfirmModal from "./components/payroll/PublishConfirmModal";
import PdfProgress from "./components/payroll/PdfProgress";
import EmptyRunState from "./components/payroll/EmptyRunState";
import {
    ACTIVE_JOB_STATUSES,
    formatMonthYear,
    getPdfProgress,
    getRunSteps,
} from "./components/payroll/payrollUi";
import payrollService from "../services/payrollService";

import "./AdminDashboard.css";
import "./Payroll.css";

const PAGE_SIZE = 100;

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
}

async function fetchAllPayslips(runId) {
    const first = await payrollService.getPayslips(runId, {
        page: 1,
        pageSize: PAGE_SIZE,
    });

    const items = Array.isArray(first.data?.items) ? [...first.data.items] : [];
    const total = Number(first.data?.total) || items.length;
    let page = 1;

    while (items.length < total && page < 50) {
        page += 1;
        const next = await payrollService.getPayslips(runId, {
            page,
            pageSize: PAGE_SIZE,
        });
        const nextItems = Array.isArray(next.data?.items) ? next.data.items : [];
        if (nextItems.length === 0) break;
        items.push(...nextItems);
    }

    return items;
}

function PayrollSkeleton() {
    return (
        <div className="payroll-skeleton" aria-hidden="true">
            <Skeleton variant="rounded" height={72} />
            <div className="payroll-skeleton-cards">
                {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} variant="rounded" height={132} />
                ))}
            </div>
            <Skeleton variant="rounded" height={340} />
        </div>
    );
}

function CalculationState({ active, onRefresh }) {
    return (
        <section className="payroll-calc-state">
            {active ? (
                <CircularProgress size={30} />
            ) : (
                <span className="payroll-calc-icon">
                    <RefreshRounded />
                </span>
            )}
            <h2>{active ? "Payslips calculate ho rahi hain" : "Abhi koi payslip nahi hai"}</h2>
            <p>
                {active
                    ? "Calculation complete hone par totals aur review table yahan update ho jayegi."
                    : "Run calculate karke payslips generate kijiye."}
            </p>
            {!active && (
                <Button
                    type="button"
                    variant="outlined"
                    className="payroll-secondary-btn"
                    startIcon={<RefreshRounded />}
                    onClick={onRefresh}
                >
                    Refresh
                </Button>
            )}
        </section>
    );
}

function Payroll() {
    const navigate = useNavigate();
    const now = useMemo(() => new Date(), []);
    const [user] = useState(getStoredUser);
    const [collapsed, setCollapsed] = useState(false);

    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [run, setRun] = useState(null);
    const [payslips, setPayslips] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [busy, setBusy] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [drawerPayslipId, setDrawerPayslipId] = useState(null);
    const [notice, setNotice] = useState(null);

    const role = user?.role;
    const authorized = role === "OWNER" || role === "HR";
    const monthLabel = formatMonthYear(month, year);

    const fetchRunBundle = useCallback(async (runId) => {
        const [runResponse, payslipItems, jobsResponse] = await Promise.all([
            payrollService.getRun(runId),
            fetchAllPayslips(runId),
            payrollService.getJobs(runId),
        ]);

        return {
            run: runResponse.data,
            payslips: payslipItems,
            jobs: Array.isArray(jobsResponse.data) ? jobsResponse.data : [],
        };
    }, []);

    const loadPayroll = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const runsResponse = await payrollService.getRuns();
            const runs = Array.isArray(runsResponse.data) ? runsResponse.data : [];
            const selected = runs.find(
                (item) => Number(item.month) === Number(month) && Number(item.year) === Number(year)
            );

            if (!selected) {
                setRun(null);
                setPayslips([]);
                setJobs([]);
                return;
            }

            const bundle = await fetchRunBundle(selected.id);
            setRun(bundle.run);
            setPayslips(bundle.payslips);
            setJobs(bundle.jobs);
        } catch (error) {
            setPageError(
                error.response?.data?.message ||
                "Payroll load nahi hui. Connection check karke retry karein."
            );
            setRun(null);
            setPayslips([]);
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [fetchRunBundle, month, year]);

    const refreshRunQuietly = useCallback(async (runId) => {
        try {
            const bundle = await fetchRunBundle(runId);
            setRun(bundle.run);
            setPayslips(bundle.payslips);
            setJobs(bundle.jobs);
        } catch {
            /* Polling failure silently ignored; next tick retries. */
        }
    }, [fetchRunBundle]);

    useEffect(() => {
        loadPayroll();
    }, [loadPayroll]);

    const hasActiveJob = jobs.some((job) => ACTIVE_JOB_STATUSES.includes(job.status));
    const hasActiveCalculation = jobs.some(
        (job) => job.type === "CALCULATE_RUN" && ACTIVE_JOB_STATUSES.includes(job.status)
    );

    useEffect(() => {
        if (!run?.id || !hasActiveJob) return undefined;

        const timer = setInterval(() => refreshRunQuietly(run.id), 3000);
        return () => clearInterval(timer);
    }, [hasActiveJob, refreshRunQuietly, run?.id]);

    const steps = useMemo(() => getRunSteps(run, payslips, jobs), [jobs, payslips, run]);
    const pdfProgress = useMemo(() => getPdfProgress(run, payslips, jobs), [jobs, payslips, run]);

    const warningsCount = Number(run?.warningsCount) || 0;
    const canRecalculate = run?.status === "DRAFT" && !hasActiveCalculation;
    const canPublish =
        !!run &&
        (run.status === "DRAFT" || run.status === "APPROVED") &&
        warningsCount === 0 &&
        !hasActiveCalculation &&
        payslips.length > 0;

    const handleMonthChange = (nextMonth, nextYear) => {
        setCreateOpen(false);
        setMonth(nextMonth);
        setYear(nextYear);
    };

    const handleCreate = async () => {
        setBusy("create");
        try {
            await payrollService.createRun({ month, year });
            setCreateOpen(false);
            setNotice({ severity: "success", message: `${monthLabel} payroll run created.` });
            await loadPayroll();
        } catch (error) {
            setNotice({
                severity: "error",
                message: error.response?.data?.message || "Payroll run create nahi hui.",
            });
        } finally {
            setBusy("");
        }
    };

    const handleRecalculate = async () => {
        if (!run) return;
        setBusy("recalculate");
        try {
            await payrollService.recalculate(run.id);
            setNotice({ severity: "success", message: "Payroll recalculation queued." });
            await loadPayroll();
        } catch (error) {
            setNotice({
                severity: "error",
                message: error.response?.data?.message || "Recalculation start nahi hui.",
            });
        } finally {
            setBusy("");
        }
    };

    const handlePublish = async () => {
        if (!run) return;
        setBusy("publish");

        try {
            if (run.status === "DRAFT") {
                await payrollService.approve(run.id);
            }
            await payrollService.publish(run.id);
            setPublishOpen(false);
            setNotice({ severity: "success", message: `${monthLabel} payroll published.` });
            await loadPayroll();
        } catch (error) {
            setPublishOpen(false);
            setNotice({
                severity: "error",
                message:
                    error.response?.data?.message ||
                    "Payroll publish nahi hui. Refresh karke dobara koshish karein.",
            });
            await loadPayroll();
        } finally {
            setBusy("");
        }
    };

    const handleAdjustmentSaved = async (result) => {
        setDrawerPayslipId(null);
        setNotice({
            severity: "success",
            message: result?.data?.message || "Adjustment saved. Recalculation queued.",
        });
        await loadPayroll();
    };

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Administrator"
        : "Administrator";

    if (!authorized) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="dash-page emp-page payroll-page">
            <Sidebar
                activeKey="payroll"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((value) => !value)}
            />
            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={role || "OWNER"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed((value) => !value)}
                />

                <div className="dash-content payroll-content">
                    <div className="payroll-mobile-blocker">
                        <span className="payroll-mobile-icon">
                            <LaptopMacOutlined />
                        </span>
                        <h1>Payroll desktop par kholen</h1>
                        <p>
                            Better review aur bulk actions ke liye payroll ko laptop ya desktop par
                            access karein.
                        </p>
                        <Button
                            type="button"
                            variant="outlined"
                            className="payroll-secondary-btn"
                            startIcon={<RefreshRounded />}
                            onClick={loadPayroll}
                        >
                            Refresh
                        </Button>
                    </div>

                    <div className="payroll-desktop-only">
                        <PayrollHeader
                            month={month}
                            year={year}
                            run={run}
                            onMonthChange={handleMonthChange}
                            onRecalculate={handleRecalculate}
                            onPublish={() => setPublishOpen(true)}
                            canRecalculate={canRecalculate}
                            canPublish={canPublish}
                            busy={busy}
                        />

                        {pageError && (
                            <Alert
                                severity="error"
                                className="payroll-page-alert"
                                action={
                                    <Button color="inherit" size="small" onClick={loadPayroll}>
                                        Retry
                                    </Button>
                                }
                            >
                                {pageError}
                            </Alert>
                        )}

                        {loading ? (
                            <PayrollSkeleton />
                        ) : run ? (
                            <>
                                <PayrollStepper steps={steps} />
                                <SummaryCards run={run} loading={false} />

                                {warningsCount > 0 && (
                                    <Alert severity="warning" className="payroll-page-alert">
                                        <strong>{warningsCount} warnings pending.</strong> Publish
                                        se pehle review table se affected payslips fix karein.
                                    </Alert>
                                )}

                                <PdfProgress
                                    progress={pdfProgress}
                                    onRefresh={() => refreshRunQuietly(run.id)}
                                />

                                {payslips.length > 0 ? (
                                    <PayslipReviewTable
                                        payslips={payslips}
                                        onEdit={(payslip) => setDrawerPayslipId(payslip.id)}
                                    />
                                ) : (
                                    <CalculationState
                                        active={hasActiveCalculation}
                                        onRefresh={loadPayroll}
                                    />
                                )}
                            </>
                        ) : (
                            <EmptyRunState
                                monthLabel={monthLabel}
                                onCreate={() => setCreateOpen(true)}
                                creating={busy === "create"}
                            />
                        )}
                    </div>
                </div>
            </div>

            <AdjustmentDrawer
                open={!!drawerPayslipId}
                payslipId={drawerPayslipId}
                runStatus={run?.status}
                onClose={() => setDrawerPayslipId(null)}
                onSaved={handleAdjustmentSaved}
            />

            <ConfirmModal
                open={createOpen}
                title={`Create ${monthLabel} payroll?`}
                message={`${monthLabel} ke liye naya payroll run ban jayega. Aap ise later calculate aur publish kar sakte hain.`}
                confirmLabel="Create Payroll"
                danger={false}
                loading={busy === "create"}
                onClose={() => setCreateOpen(false)}
                onConfirm={handleCreate}
            />

            <PublishConfirmModal
                open={publishOpen}
                run={run}
                payslips={payslips}
                busy={busy === "publish"}
                onClose={() => setPublishOpen(false)}
                onConfirm={handlePublish}
            />

            <Snackbar
                open={!!notice}
                autoHideDuration={4000}
                onClose={() => setNotice(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity={notice?.severity || "info"}
                    variant="filled"
                    onClose={() => setNotice(null)}
                    sx={{ width: "100%" }}
                >
                    {notice?.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default Payroll;
