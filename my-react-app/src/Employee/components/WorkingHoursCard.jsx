import React, { useState, useEffect } from "react";
import {
    Card, CardContent, Typography, Box, Chip, Skeleton, Divider,
} from "@mui/material";
import { AccessTimeOutlined, TrendingUpOutlined } from "@mui/icons-material";

import employeeServ from "../../services/employeeService";
import useIsMobile from "../../hooks/useIsMobile";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_COLORS = {
    today: "linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%)",
    normal: "linear-gradient(180deg, #c7d2fe 0%, #a5b4fc 100%)",
    empty: "#f3f4f6",
};

function calcHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const [cH, cM] = checkIn.split(":").map(Number);
    const [oH, oM] = checkOut.split(":").map(Number);
    return Math.max(0, ((oH * 60 + oM) - (cH * 60 + cM)) / 60);
}

function WorkingHoursCard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const isMobile = useIsMobile();

    useEffect(() => {
        const fetch = async () => {
            try {
                const { data: res } = await employeeServ.getWeeklyAttendance();
                setData(res);
            } catch {
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const todayIdx = new Date().getDay();
    const adjustedTodayIdx = todayIdx === 0 ? 6 : todayIdx - 1;

    const hoursPerDay = DAY_LABELS.map((_, idx) => {
        const record = data?.[idx];
        if (record) {
            return { hours: calcHours(record.checkIn, record.checkOut), isToday: idx === adjustedTodayIdx };
        }
        return { hours: 0, isToday: idx === adjustedTodayIdx };
    });

    const maxHours = Math.max(...hoursPerDay.map((d) => d.hours), 1);
    const totalHours = hoursPerDay.reduce((sum, d) => sum + d.hours, 0);
    const daysWorked = hoursPerDay.filter((d) => d.hours > 0).length;
    const avgHours = daysWorked > 0 ? (totalHours / daysWorked).toFixed(1) : "0.0";

    return (
        <Card sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            height: "100%",
            borderLeft: "4px solid #8b5cf6",
            transition: "all 0.25s ease",
            "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transform: "translateY(-1px)" },
        }}>
            <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: { xs: 1, sm: 2.5 }, flexWrap: "wrap", gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1, fontSize: { xs: 14, sm: 18 } }}>
                        <AccessTimeOutlined sx={{ color: "#4f46e5" }} />
                        Working Hours
                    </Typography>
                    <Chip
                        icon={<TrendingUpOutlined sx={{ fontSize: 15 }} />}
                        label={`${totalHours.toFixed(1)}h this week`}
                        size="small"
                        sx={{ bgcolor: "#eef2ff", color: "#4338ca", fontWeight: 600, borderRadius: 2, fontSize: 12 }}
                    />
                </Box>

                {loading ? (
                    <Box>
                        <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                    </Box>
                ) : (
                    <>
                        {/* Bar Chart */}
                        <Box sx={{
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "space-between",
                            height: isMobile ? 96 : 150,
                            gap: { xs: 0.5, sm: 1 },
                            px: 0.25,
                            mt: { xs: 0.5, sm: 1 },
                        }}>
                            {hoursPerDay.map((day, idx) => {
                                const barHeight = maxHours > 0 ? (day.hours / maxHours) * (isMobile ? 64 : 104) : 0;
                                return (
                                    <Box key={idx} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                                        <Typography variant="caption" sx={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: day.hours > 0 ? "#374151" : "#d1d5db",
                                        }}>
                                            {day.hours > 0 ? `${day.hours.toFixed(1)}h` : ""}
                                        </Typography>
                                        <Box sx={{
                                            width: "100%",
                                            maxWidth: 36,
                                            height: barHeight || 4,
                                            borderRadius: "6px 6px 4px 4px",
                                            background: day.hours > 0
                                                ? (day.isToday ? DAY_COLORS.today : DAY_COLORS.normal)
                                                : DAY_COLORS.empty,
                                            transition: "height 0.6s ease",
                                            boxShadow: day.isToday && day.hours > 0 ? "0 4px 12px rgba(79,70,229,0.3)" : "none",
                                        }} />
                                        <Typography variant="caption" sx={{
                                            fontSize: 11,
                                            fontWeight: day.isToday ? 800 : 500,
                                            color: day.isToday ? "#4f46e5" : "#6b7280",
                                        }}>
                                            {DAY_LABELS[idx]}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>

                        <Divider sx={{ my: { xs: 0.75, sm: 2 } }} />

                        {/* Stats */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, rowGap: 0.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#4f46e5", flexShrink: 0 }} />
                                <Typography variant="body2" sx={{ color: "#6b7280", fontWeight: 500, fontSize: 12 }}>
                                    Avg: <strong style={{ color: "#171b2e" }}>{avgHours}h</strong> / day
                                </Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#c7d2fe", flexShrink: 0 }} />
                                <Typography variant="body2" sx={{ color: "#6b7280", fontWeight: 500, fontSize: 12 }}>
                                    Total: <strong style={{ color: "#171b2e" }}>{totalHours.toFixed(1)}h</strong>
                                </Typography>
                            </Box>
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default WorkingHoursCard;
