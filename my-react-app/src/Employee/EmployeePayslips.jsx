import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Card, CardContent, Typography, Box, Skeleton, Button,
    Grid, Avatar, Divider, Chip,
} from "@mui/material";
import {
    PaymentsOutlined, Download, TrendingUpOutlined,
    TrendingDownOutlined, AccountBalanceWalletOutlined,
    ReceiptLongOutlined,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import "../Admin/AdminDashboard.css";

import payslipServ from "../services/payslipService";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: PaymentsOutlined },
    { key: "my-profile", label: "My Profile", icon: PaymentsOutlined },
    { key: "my-attendance", label: "My Attendance", icon: PaymentsOutlined },
    { key: "my-leaves", label: "My Leaves", icon: PaymentsOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

function EmployeePayslips() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [payslips, setPayslips] = useState([]);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch { setUser(null); }

        const fetchData = async () => {
            try {
                const { data } = await payslipServ.getMy();
                setPayslips(data || []);
            } catch {
                setPayslips([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
        : "Employee";

    const formatCurrency = (val) => {
        if (val == null) return "—";
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
    };

    const formatMonth = (dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    };

    const totalEarnings = payslips.reduce((sum, p) => sum + (p.basicSalary || 0) + (p.allowances || 0), 0);
    const totalDeductions = payslips.reduce((sum, p) => sum + (p.deductions || 0), 0);
    const totalNet = payslips.reduce((sum, p) => sum + (p.netSalary || 0), 0);
    const totalPayslips = payslips.length;

    return (
        <div className="dash-page emp-page">
            <Sidebar activeKey="my-payslips" onLogout={handleLogout} title="HRMS" user={user} navItems={EMPLOYEE_NAV_ITEMS} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar userName={displayName} userRole={user?.role || "EMPLOYEE"} user={user} onLogout={handleLogout} collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
                <div className="dash-content">
                    <div className="emp-hero">
                        <div>
                            <h1>My Payslips</h1>
                            <p>Download and view your salary slips</p>
                        </div>
                        <span className="emp-hero-chip">
                            {totalPayslips} {totalPayslips === 1 ? "payslip" : "payslips"}
                        </span>
                    </div>

                    {/* Summary Stats */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {[
                            { label: "Total Earnings", value: formatCurrency(totalEarnings), color: "#059669", icon: <TrendingUpOutlined /> },
                            { label: "Total Deductions", value: formatCurrency(totalDeductions), color: "#dc2626", icon: <TrendingDownOutlined /> },
                            { label: "Net Pay", value: formatCurrency(totalNet), color: "#4f46e5", icon: <AccountBalanceWalletOutlined /> },
                            { label: "Total Payslips", value: payslips.length, color: "#d97706", icon: <ReceiptLongOutlined /> },
                        ].map((stat) => (
                            <Grid size={{ xs: 6, sm: 3 }} key={stat.label}>
                                <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", height: "100%" }}>
                                    <CardContent sx={{ p: 2.5, textAlign: "center" }}>
                                        <Avatar sx={{ width: 44, height: 44, bgcolor: `${stat.color}15`, color: stat.color, mx: "auto", mb: 1.5 }}>
                                            {stat.icon}
                                        </Avatar>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: stat.color, fontSize: { xs: 16, sm: 20 } }}>{stat.value}</Typography>
                                        <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 500 }}>{stat.label}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Payslips List */}
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#171b2e" }}>Payslip History</Typography>

                    {loading ? (
                        <Grid container spacing={2}>
                            {[1, 2, 3].map((i) => (
                                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                                    <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Skeleton variant="text" width="60%" height={28} />
                                            <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
                                            <Skeleton variant="rectangular" height={80} sx={{ mt: 2, borderRadius: 1 }} />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    ) : payslips.length > 0 ? (
                        <Grid container spacing={2}>
                            {payslips.map((payslip) => (
                                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={payslip.id}>
                                    <Card
                                        sx={{
                                            borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", height: "100%",
                                            transition: "all 0.2s",
                                            "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.12)", transform: "translateY(-2px)" },
                                        }}
                                    >
                                        <Box sx={{
                                            background: "linear-gradient(135deg, #4f46e5 0%, #667eea 100%)",
                                            p: 2.5, color: "white",
                                        }}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Box>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                        {formatMonth(payslip.payPeriod || payslip.month)}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                                        {payslip.employeeCode || " Payslip"}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    label={payslip.status || "Generated"}
                                                    size="small"
                                                    sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", fontWeight: 600 }}
                                                />
                                            </Box>
                                        </Box>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                    <Typography variant="body2" sx={{ color: "#6b7280" }}>Basic Salary</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(payslip.basicSalary)}</Typography>
                                                </Box>
                                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                    <Typography variant="body2" sx={{ color: "#6b7280" }}>Allowances</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#059669" }}>+{formatCurrency(payslip.allowances)}</Typography>
                                                </Box>
                                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                    <Typography variant="body2" sx={{ color: "#6b7280" }}>Deductions</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#dc2626" }}>-{formatCurrency(payslip.deductions)}</Typography>
                                                </Box>
                                                <Divider />
                                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#171b2e" }}>Net Pay</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 800, color: "#4f46e5", fontSize: 16 }}>{formatCurrency(payslip.netSalary)}</Typography>
                                                </Box>
                                            </Box>
                                            <Button
                                                variant="outlined"
                                                fullWidth
                                                startIcon={<Download />}
                                                href={payslipServ.getDownloadUrl(payslip.id)}
                                                target="_blank"
                                                sx={{
                                                    mt: 2, textTransform: "none", fontWeight: 600, borderRadius: 2,
                                                    borderColor: "#4f46e5", color: "#4f46e5",
                                                    "&:hover": { borderColor: "#4338ca", bgcolor: "#f5f3ff" },
                                                }}
                                            >
                                                Download
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                            <CardContent sx={{ textAlign: "center", py: 6 }}>
                                <PaymentsOutlined sx={{ fontSize: 48, color: "#d1d5db", mb: 2 }} />
                                <Typography variant="body1" sx={{ color: "#9ca3af", fontWeight: 500 }}>
                                    No payslips available yet. Your payslips will appear here once generated.
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EmployeePayslips;
