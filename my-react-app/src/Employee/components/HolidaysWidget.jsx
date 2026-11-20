import React, { useState, useEffect } from "react";
import {
    Card, CardContent, Typography, Box, Chip, Skeleton,
} from "@mui/material";
import { CelebrationOutlined } from "@mui/icons-material";
import EmptyState from "./EmptyState";

import holidayServ from "../../services/holidayService";

function HolidaysWidget() {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const { data } = await holidayServ.getUpcoming();
                setHolidays(data.slice(0, 3));
            } catch {
                setHolidays([]);
            } finally {
                setLoading(false);
            }
        };
        fetchHolidays();
    }, []);

    const formatDate = (d) => {
        if (!d) return "";
        return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const getDaysUntil = (d) => {
        const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
        if (diff === 0) return "Today";
        if (diff === 1) return "Tomorrow";
        return `In ${diff} days`;
    };

    return (
        <Card sx={{ borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", height: "100%", borderLeft: "4px solid #d97706", transition: "all 0.25s ease", "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transform: "translateY(-1px)" } }}>
            <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1 }}>
                        <CelebrationOutlined sx={{ color: "#d97706" }} />
                        Upcoming Holidays
                    </Typography>
                </Box>

                {loading ? (
                    <Box>
                        {[1, 2, 3].map((i) => (
                            <Box key={i} sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                                <Skeleton variant="text" width="55%" height={20} />
                                <Skeleton variant="text" width="25%" height={20} />
                            </Box>
                        ))}
                    </Box>
                ) : holidays.length > 0 ? (
                    <Box>
                        {/* Next up spotlight */}
                        <Box className="emp-nextup">
                            <Box className="emp-nextup-icon">
                                <CelebrationOutlined sx={{ fontSize: 22 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 9.5, display: "block" }}>
                                    Next Up
                                </Typography>
                                <Typography sx={{ fontWeight: 800, color: "#171b2e", fontSize: 15, lineHeight: 1.3 }}>
                                    {holidays[0].name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 500 }}>
                                    {formatDate(holidays[0].date)}
                                </Typography>
                            </Box>
                            <Chip label={getDaysUntil(holidays[0].date)} size="small" sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 800, fontSize: 11, borderRadius: 2 }} />
                        </Box>

                        {holidays.length > 1 && (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2, mt: 1.5 }}>
                                {holidays.slice(1).map((h) => (
                                    <Box key={h.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#171b2e" }}>
                                                {h.name}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                                                {formatDate(h.date)}
                                            </Typography>
                                        </Box>
                                        <Chip label={getDaysUntil(h.date)} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                ) : (
                    <EmptyState
                        icon={<CelebrationOutlined sx={{ fontSize: 26, color: "#d97706" }} />}
                        title="No upcoming holidays"
                        subtitle="Sit tight — we'll show upcoming holidays here."
                    />
                )}
            </CardContent>
        </Card>
    );
}

export default HolidaysWidget;
