import React, { useState, useEffect } from "react";
import { Card, CardContent, Typography, Box, Skeleton } from "@mui/material";
import { ShowChartOutlined } from "@mui/icons-material";
import attendanceServ from "../../services/attendanceService";

const SERIES = [
    { key: "present", label: "Present", color: "#059669" },
    { key: "late", label: "Late", color: "#d97706" },
    { key: "absent", label: "Absent", color: "#dc2626" },
];

function buildMonths(count) {
    const now = new Date();
    const months = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label: d.toLocaleDateString("en-IN", { month: "short" }),
            present: 0,
            late: 0,
            absent: 0,
        });
    }
    return months;
}

function AttendanceTrendCard() {
    const [months, setMonths] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const monthsData = buildMonths(6);
                const today = new Date();
                const first = new Date(today.getFullYear(), today.getMonth() - 5, 1);
                const fromDate = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-01`;
                const toDate = today.toISOString().split("T")[0];
                const { data } = await attendanceServ.getMyHistory(fromDate, toDate);
                (Array.isArray(data) ? data : []).forEach((r) => {
                    const key = r.attendanceDate ? String(r.attendanceDate).slice(0, 7) : "";
                    const bucket = monthsData.find((m) => m.key === key);
                    if (!bucket) return;
                    const s = (r.status || "").toLowerCase();
                    if (s === "late") bucket.late++;
                    else if (s === "absent") bucket.absent++;
                    else bucket.present++;
                });
                setMonths(monthsData);
            } catch {
                setMonths(buildMonths(6));
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const maxCount = Math.max(1, ...(months || []).map((m) => m.present + m.late + m.absent));

    return (
        <Card sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            height: "100%",
            borderLeft: "4px solid #6366f1",
            transition: "all 0.25s ease",
            "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transform: "translateY(-1px)" },
        }}>
            <CardContent sx={{ p: 3.5, "&:first-child": { pb: 2.5 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1, fontSize: 18 }}>
                        <ShowChartOutlined sx={{ color: "#4f46e5" }} />
                        Attendance Trend
                    </Typography>
                    <Box className="emp-trend-legend">
                        {SERIES.map((s) => (
                            <span key={s.key} className="emp-trend-legend-item">
                                <span className="emp-trend-legend-dot" style={{ background: s.color }} />
                                {s.label}
                            </span>
                        ))}
                    </Box>
                </Box>

                {loading ? (
                    <Box>
                        <Skeleton variant="rectangular" height={190} sx={{ borderRadius: 2 }} />
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 210, gap: 1.5, px: 0.5, mt: 1 }}>
                        {months.map((m, idx) => (
                            <Box key={m.key} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160 }}>
                                    {SERIES.map((s) => {
                                        const val = m[s.key];
                                        const h = val > 0 ? Math.max(6, (val / maxCount) * 140) : 3;
                                        return (
                                            <Box key={s.key} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                                                <Typography variant="caption" sx={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color: val > 0 ? s.color : "#d1d5db",
                                                    lineHeight: 1,
                                                }}>
                                                    {val > 0 ? val : ""}
                                                </Typography>
                                                <Box sx={{
                                                    width: { xs: 10, md: 14 },
                                                    height: h,
                                                    borderRadius: "6px 6px 3px 3px",
                                                    background: val > 0 ? s.color : "#f3f4f6",
                                                    transition: "height 0.6s ease",
                                                    boxShadow: val > 0 ? `0 3px 8px ${s.color}55` : "none",
                                                }} />
                                            </Box>
                                        );
                                    })}
                                </Box>
                                <Typography variant="caption" sx={{
                                    fontSize: 12,
                                    fontWeight: idx === 5 ? 800 : 500,
                                    color: idx === 5 ? "#4f46e5" : "#6b7280",
                                }}>
                                    {m.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}

                <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4f46e5" }} />
                    <Typography variant="body2" sx={{ color: "#6b7280", fontWeight: 500, fontSize: 13 }}>
                        Last 6 months · today marked in <strong style={{ color: "#171b2e" }}>violet</strong>
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}

export default AttendanceTrendCard;