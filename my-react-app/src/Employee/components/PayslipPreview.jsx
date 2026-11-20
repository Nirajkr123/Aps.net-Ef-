import React, { useState, useEffect } from "react";
import {
    Card, CardContent, Typography, Box, Button, Skeleton,
} from "@mui/material";
import { PaymentsOutlined, Download } from "@mui/icons-material";

import payslipServ from "../../services/payslipService";

function PayslipPreview() {
    const [payslip, setPayslip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const fetchLatest = async () => {
            try {
                const { data } = await payslipServ.getLatest();
                setPayslip(data);
            } catch {
                setPayslip(null);
            } finally {
                setLoading(false);
            }
        };
        fetchLatest();
    }, []);

    const formatPeriod = (month, year) => {
        if (!month || !year) return "";
        return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
        });
    };

    const handleDownload = async () => {
        if (!payslip?.id) return;

        setDownloading(true);
        try {
            await payslipServ.downloadPayslip(
                payslip.id,
                `Payslip-${payslip.employeeCode || payslip.id}-${payslip.month}-${payslip.year}.pdf`
            );
        } catch (error) {
            console.error("Payslip download failed.", error);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Card sx={{ borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", height: "100%", transition: "all 0.25s ease", "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transform: "translateY(-1px)" } }}>
            <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1 }}>
                        <PaymentsOutlined sx={{ color: "#d97706" }} />
                        Recent Payslip
                    </Typography>
                </Box>

                {loading ? (
                    <Box>
                        <Skeleton variant="text" width="50%" height={28} />
                        <Skeleton variant="text" width="40%" height={40} />
                        <Skeleton variant="rectangular" height={40} sx={{ mt: 2, borderRadius: 1 }} />
                    </Box>
                ) : payslip ? (
                    <Box>
                        <Typography variant="body2" sx={{ color: "#6b7280", mb: 0.5, fontWeight: 500 }}>
                            {formatPeriod(payslip.month, payslip.year)}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: "#171b2e", mb: 2 }}>
                            ₹{Number(payslip.netPay).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#9ca3af", mb: 2 }}>
                            Net Pay
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<Download />}
                            onClick={handleDownload}
                            disabled={downloading}
                            fullWidth
                            sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                borderRadius: 2,
                                borderColor: "#d1d5db",
                                color: "#374151",
                                "&:hover": { borderColor: "#4f46e5", color: "#4f46e5" },
                            }}
                        >
                            {downloading ? "Downloading..." : "Download Payslip"}
                        </Button>
                    </Box>
                ) : (
                    <Typography variant="body2" sx={{ color: "#9ca3af", py: 2, textAlign: "center" }}>
                        No payslip available yet.
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

export default PayslipPreview;
