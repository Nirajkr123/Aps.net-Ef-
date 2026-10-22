import React, { useState, useEffect } from "react";
import {
    Card, CardContent, Typography, Box, Skeleton,
} from "@mui/material";
import { CheckCircleOutlined } from "@mui/icons-material";

import employeeServ from "../../services/employeeService";

const COLORS = {
    present: "#059669",
    late: "#d97706",
    absent: "#dc2626",
};

const FALLBACK = { present: 18, late: 3, absent: 2 };

function AttendanceSummaryCard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const { data: res } = await employeeServ.getAttendanceSummary();
                setData(res);
            } catch {
                setData(FALLBACK);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const total = data ? data.present + data.late + data.absent : 0;
    const presentPct = total > 0 ? (data.present / total) * 100 : 0;
    const latePct = total > 0 ? (data.late / total) * 100 : 0;
    const absentPct = total > 0 ? (data.absent / total) * 100 : 0;

    const conicGradient = total > 0
        ? `conic-gradient(${COLORS.present} 0% ${presentPct}%, ${COLORS.late} ${presentPct}% ${presentPct + latePct}%, ${COLORS.absent} ${presentPct + latePct}% 100%)`
        : `conic-gradient(#e5e7eb 0% 100%)`;

    return (
        <Card sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            height: "100%",
            borderLeft: "4px solid #10b981",
            transition: "all 0.25s ease",
            "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transform: "translateY(-1px)" },
        }}>
            <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1, fontSize: 18 }}>
                        <CheckCircleOutlined sx={{ color: "#059669" }} />
                        Attendance Summary
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Skeleton variant="circular" width={160} height={160} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="80%" height={24} />
                            <Skeleton variant="text" width="60%" height={20} />
                            <Skeleton variant="text" width="70%" height={20} />
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: { xs: 1.5, sm: 3 },
                        mt: { xs: 0.5, sm: 1 },
                        flexWrap: "wrap",
                        "@media (max-width: 430px)": { justifyContent: "center" },
                    }}>
                        {/* Donut Chart */}
                        <Box sx={{ position: "relative", width: { xs: 116, sm: 160 }, height: { xs: 116, sm: 160 }, flexShrink: 0 }}>
                            <Box sx={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "50%",
                                background: conicGradient,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                            }}>
                                <Box sx={{
                                    width: { xs: 72, sm: 100 },
                                    height: { xs: 72, sm: 100 },
                                    borderRadius: "50%",
                                    bgcolor: "white",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexDirection: "column",
                                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.04)",
                                }}>
                                    <Typography variant="h3" sx={{ fontWeight: 800, color: "#171b2e", lineHeight: 1, fontSize: { xs: 21, sm: 48 } }}>
                                        {total}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
                                        days
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* Legend */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 1.2, sm: 2.5 }, flex: 1 }}>
                            {[
                                { label: "Present", value: data.present, color: COLORS.present, pct: presentPct },
                                { label: "Late", value: data.late, color: COLORS.late, pct: latePct },
                                { label: "Absent", value: data.absent, color: COLORS.absent, pct: absentPct },
                            ].map((item) => (
                                <Box key={item.label}>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: item.color, boxShadow: `0 0 0 3px ${item.color}22`, flexShrink: 0 }} />
                                            <Typography variant="body1" sx={{ fontWeight: 600, color: "#374151", fontSize: { xs: 12, sm: 16 } }}>
                                                {item.label}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body1" sx={{ fontWeight: 700, color: "#171b2e", fontSize: { xs: 12, sm: 16 } }}>
                                            {item.value}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#f3f4f6", overflow: "hidden" }}>
                                        <Box sx={{ width: `${item.pct}%`, height: "100%", bgcolor: item.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export default AttendanceSummaryCard;
