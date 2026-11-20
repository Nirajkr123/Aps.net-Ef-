import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Alert,
    Button,
    Card,
    CardContent,
    Skeleton,
    Snackbar,
} from "@mui/material";
import {
    PaymentsOutlined,
    RefreshOutlined,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import LatestPayslipCard from "./components/payslips/LatestPayslipCard";
import PayslipHeader from "./components/payslips/PayslipHeader";
import PayslipTable from "./components/payslips/PayslipTable";
import { AMOUNT_HIDDEN_KEY, getPayslipStatus } from "./components/payslips/payslipUi";
import payslipServ from "../services/payslipService";

import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";
import "./EmployeePayslips.css";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: PaymentsOutlined },
    { key: "my-profile", label: "My Profile", icon: PaymentsOutlined },
    { key: "my-attendance", label: "My Attendance", icon: PaymentsOutlined },
    { key: "my-leaves", label: "My Leaves", icon: PaymentsOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, index) => CURRENT_YEAR - index);

function PayslipSkeleton() {
    return (
        <div className="payslip-layout" aria-hidden="true">
            <Card className="payslip-latest-card payslip-skeleton-card" elevation={0}>
                <CardContent>
                    <Skeleton variant="text" width="42%" height={20} />
                    <Skeleton variant="text" width="34%" height={48} sx={{ mt: 2 }} />
                    <Skeleton variant="rounded" height={68} sx={{ mt: 2, borderRadius: 2 }} />
                    <Skeleton variant="text" height={24} sx={{ mt: 2 }} />
                    <Skeleton variant="text" height={24} width="80%" />
                    <Skeleton variant="rounded" height={50} sx={{ mt: 2, borderRadius: 2 }} />
                </CardContent>
            </Card>
            <Card className="payslip-history payslip-skeleton-card" elevation={0}>
                <CardContent>
                    <Skeleton variant="text" width="32%" height={28} />
                    {[0, 1, 2, 3, 4].map((row) => (
                        <div className="payslip-skeleton-row" key={row}>
                            <Skeleton variant="text" width="24%" height={24} />
                            <Skeleton variant="text" width="16%" height={24} />
                            <Skeleton variant="text" width="16%" height={24} />
                            <Skeleton variant="text" width="18%" height={24} />
                            <Skeleton variant="circular" width={40} height={40} />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

function PayslipEmptyState() {
    return (
        <Card className="payslip-state-card" elevation={0}>
            <span className="payslip-state-icon">
                <PaymentsOutlined />
            </span>
            <h2>Is saal ki koi payslip nahi.</h2>
            <p>Jab payroll publish hoga, aapki payslip yahan dikhegi.</p>
        </Card>
    );
}

function PayslipErrorState({ onRetry }) {
    return (
        <Card className="payslip-state-card" elevation={0} role="alert">
            <span className="payslip-state-icon is-error">
                <RefreshOutlined />
            </span>
            <h2>Payslip load nahi hui</h2>
            <p>Connection check karein aur dobara koshish karein.</p>
            <Button
                type="button"
                variant="contained"
                className="payslip-retry-btn"
                startIcon={<RefreshOutlined />}
                onClick={onRetry}
            >
                Retry
            </Button>
        </Card>
    );
}

function EmployeePayslips() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [year, setYear] = useState(CURRENT_YEAR);
    const [payslips, setPayslips] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [pageError, setPageError] = useState("");
    const [detailError, setDetailError] = useState("");
    const [detailRetryToken, setDetailRetryToken] = useState(0);
    const [downloadingId, setDownloadingId] = useState(null);
    const [amountsHidden, setAmountsHidden] = useState(() => {
        try {
            return localStorage.getItem(AMOUNT_HIDDEN_KEY) === "true";
        } catch {
            return false;
        }
    });
    const [toast, setToast] = useState({
        open: false,
        severity: "success",
        message: "",
        retry: null,
    });

    const years = useMemo(() => YEAR_OPTIONS, []);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch {
            setUser(null);
        }
    }, []);

    const loadPayslips = useCallback(async (targetYear, preferredId = null) => {
        setLoading(true);
        setPageError("");

        try {
            const { data } = await payslipServ.getMy({ year: targetYear });
            const items = Array.isArray(data) ? data : [];
            setPayslips(items);

            const preferred = preferredId && items.some((item) => item.id === preferredId)
                ? preferredId
                : items[0]?.id ?? null;
            setSelectedId(preferred);
        } catch {
            setPayslips([]);
            setSelectedId(null);
            setDetail(null);
            setPageError("Payslip load nahi hui");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPayslips(year);
    }, [loadPayslips, year]);

    useEffect(() => {
        if (!selectedId) {
            setDetail(null);
            setDetailError("");
            setDetailLoading(false);
            return undefined;
        }

        let cancelled = false;
        setDetail(null);
        setDetailLoading(true);
        setDetailError("");

        payslipServ.getById(selectedId)
            .then(({ data }) => {
                if (!cancelled) setDetail(data);
            })
            .catch(() => {
                if (!cancelled) setDetailError("Payslip detail load nahi hui.");
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedId, detailRetryToken]);

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
        : "Employee";

    const selectedPayslip = payslips.find((item) => item.id === selectedId) || payslips[0] || null;
    const selectedDetail = detail?.id === selectedPayslip?.id ? detail : null;

    const handleYearChange = (nextYear) => {
        if (nextYear === year) return;
        setSelectedId(null);
        setDetail(null);
        setDetailError("");
        setPageError("");
        setYear(nextYear);
    };

    const handleSelect = (payslip) => {
        if (payslip?.id) setSelectedId(payslip.id);
    };

    const handleToggleAmounts = () => {
        setAmountsHidden((previous) => {
            const next = !previous;
            try {
                localStorage.setItem(AMOUNT_HIDDEN_KEY, String(next));
            } catch {
                return next;
            }
            return next;
        });
    };

    const handleDownload = async (payslip) => {
        if (!payslip?.id) return;
        const meta = getPayslipStatus(payslip);
        if (!meta.canDownload) return;

        setDownloadingId(payslip.id);
        try {
            await payslipServ.downloadPayslip(
                payslip.id,
                `Payslip-${payslip.employeeCode || payslip.id}-${payslip.month}-${payslip.year}.pdf`
            );
            setToast({
                open: true,
                severity: "success",
                message: "Payslip download ho gayi",
                retry: null,
            });
        } catch {
            setToast({
                open: true,
                severity: "error",
                message: "Payslip download nahi hui. Retry karein.",
                retry: () => handleDownload(payslip),
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const closeToast = (_event, reason) => {
        if (reason === "clickaway") return;
        setToast((previous) => ({ ...previous, open: false, retry: null }));
    };

    const handleToastRetry = () => {
        const retry = toast.retry;
        setToast((previous) => ({ ...previous, open: false, retry: null }));
        if (retry) retry();
    };

    return (
        <div className="dash-page emp-page payslip-page">
            <Sidebar
                activeKey="my-payslips"
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

                <div className="dash-content payslip-content">
                    <div className="payslip-shell">
                        <PayslipHeader
                            year={year}
                            years={years}
                            onYearChange={handleYearChange}
                        />

                        {loading ? (
                            <PayslipSkeleton />
                        ) : pageError ? (
                            <PayslipErrorState
                                onRetry={() => loadPayslips(year, selectedId)}
                            />
                        ) : payslips.length === 0 ? (
                            <PayslipEmptyState />
                        ) : (
                            <div className="payslip-layout">
                                <LatestPayslipCard
                                    payslip={selectedPayslip}
                                    detail={selectedDetail}
                                    detailLoading={detailLoading}
                                    detailError={detailError}
                                    onRetryDetail={() => setDetailRetryToken((value) => value + 1)}
                                    amountsHidden={amountsHidden}
                                    onToggleAmounts={handleToggleAmounts}
                                    onDownload={() => handleDownload(selectedPayslip)}
                                    downloading={downloadingId === selectedPayslip?.id}
                                />
                                <PayslipTable
                                    payslips={payslips}
                                    selectedId={selectedPayslip?.id}
                                    onSelect={handleSelect}
                                    onDownload={handleDownload}
                                    downloadingId={downloadingId}
                                    amountsHidden={amountsHidden}
                                    year={year}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Snackbar
                open={toast.open}
                autoHideDuration={toast.severity === "error" ? 7000 : 4500}
                onClose={closeToast}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                sx={{ bottom: { xs: 84, md: 24 } }}
            >
                <Alert
                    severity={toast.severity}
                    onClose={closeToast}
                    action={
                        toast.retry ? (
                            <Button
                                type="button"
                                color="inherit"
                                size="small"
                                onClick={handleToastRetry}
                            >
                                Retry
                            </Button>
                        ) : null
                    }
                    sx={{ width: "100%", borderRadius: 2 }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default EmployeePayslips;
