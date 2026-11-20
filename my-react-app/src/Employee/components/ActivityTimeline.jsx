import React, { useState, useEffect } from "react";
import {
    Card, CardContent, Typography, Box, Skeleton,
} from "@mui/material";
import {
    AccessTimeOutlined,
    EventOutlined,
    EditOutlined,
    Login,
    WorkOutlineOutlined,
    HistoryOutlined,
} from "@mui/icons-material";
import EmptyState from "./EmptyState";

import activityServ from "../../services/activityService";

const ACTIVITY_ICONS = {
    attendance: <AccessTimeOutlined sx={{ fontSize: 18, color: "#4f46e5" }} />,
    leave: <EventOutlined sx={{ fontSize: 18, color: "#059669" }} />,
    profile: <EditOutlined sx={{ fontSize: 18, color: "#d97706" }} />,
    login: <Login sx={{ fontSize: 18, color: "#8b5cf6" }} />,
    default: <WorkOutlineOutlined sx={{ fontSize: 18, color: "#6b7280" }} />,
};

const ACTIVITY_COLORS = {
    attendance: "#eef2ff",
    leave: "#ecfdf5",
    profile: "#fffbeb",
    login: "#f5f3ff",
    default: "#f3f4f6",
};

function ActivityTimeline() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const { data } = await activityServ.getRecent();
                setActivities(data.slice(0, 5));
            } catch {
                setActivities([]);
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
    }, []);

    const formatTime = (iso) => {
        if (!iso) return "";
        const d = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now - d) / (1000 * 60 * 60));
        if (diff < 1) return "Just now";
        if (diff < 24) return `${diff}h ago`;
        if (diff < 48) return "Yesterday";
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    };

    return (
        <Card sx={{ borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", height: "100%", borderLeft: "4px solid #6366f1", transition: "all 0.25s ease", "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transform: "translateY(-1px)" } }}>
            <CardContent sx={{ p: 3.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", mb: 2 }}>
                    Recent Activity
                </Typography>

                {loading ? (
                    <Box>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Box key={i} sx={{ display: "flex", gap: 2, mb: 2 }}>
                                <Skeleton variant="circular" width={32} height={32} />
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton variant="text" width="60%" height={18} />
                                    <Skeleton variant="text" width="80%" height={14} />
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : activities.length > 0 ? (
                    <Box sx={{ position: "relative" }}>
                        <Box sx={{ position: "absolute", left: 15, top: 20, bottom: 20, width: 2, bgcolor: "#e5e7eb" }} />

                        {activities.map((item, idx) => (
                            <Box key={item.id} sx={{ display: "flex", gap: 2, mb: idx < activities.length - 1 ? 2 : 0, position: "relative" }}>
                                <Box sx={{
                                    width: 32, height: 32, borderRadius: "50%",
                                    bgcolor: ACTIVITY_COLORS[item.type] || ACTIVITY_COLORS.default,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0, zIndex: 1,
                                }}>
                                    {ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.default}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#171b2e" }}>
                                        {item.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "#6b7280" }}>
                                        {item.description}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", mt: 0.3 }}>
                                        {formatTime(item.timestamp)}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <EmptyState
                        icon={<HistoryOutlined sx={{ fontSize: 26, color: "#6366f1" }} />}
                        title="No recent activity"
                        subtitle="Your check-ins, leaves and profile changes will appear here."
                    />
                )}
            </CardContent>
        </Card>
    );
}

export default ActivityTimeline;
