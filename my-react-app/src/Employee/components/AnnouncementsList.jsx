import React, { useState, useEffect } from "react";
import {
    Card, CardContent, Typography, Box, Chip, Skeleton, Divider,
} from "@mui/material";
import { CampaignOutlined } from "@mui/icons-material";
import EmptyState from "./EmptyState";

import announcementServ from "../../services/announcementService";

function AnnouncementsList() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const { data } = await announcementServ.getRecent();
                setAnnouncements(Array.isArray(data) ? data.slice(0, 3) : []);
            } catch {
                // TODO: Backend API — GET /api/Announcements/recent
                setAnnouncements([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAnnouncements();
    }, []);

    const formatDate = (d) => {
        if (!d) return "";
        return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    return (
        <Card sx={{ borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", height: "100%", borderLeft: "4px solid #4f46e5", transition: "all 0.25s ease", "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transform: "translateY(-1px)" } }}>
            <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1 }}>
                        <CampaignOutlined sx={{ color: "#4f46e5" }} />
                        Announcements
                    </Typography>
                    {announcements.length > 0 && (
                        <Chip label={announcements.length} size="small" sx={{ bgcolor: "#eef2ff", color: "#4f46e5", fontWeight: 800, fontSize: 11 }} />
                    )}
                </Box>

                {loading ? (
                    <Box>
                        {[1, 2, 3].map((i) => (
                            <Box key={i} sx={{ mb: 1.5 }}>
                                <Skeleton variant="text" width="60%" height={20} />
                                <Skeleton variant="text" width="90%" height={16} />
                                <Skeleton variant="text" width="30%" height={14} />
                            </Box>
                        ))}
                    </Box>
                ) : announcements.length > 0 ? (
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                        {announcements.map((item, idx) => (
                            <Box key={item.id || idx}>
                                <Typography sx={{ fontWeight: 700, color: "#171b2e", fontSize: 14, lineHeight: 1.4 }}>
                                    {item.title}
                                </Typography>
                                {item.description && (
                                    <Typography variant="body2" sx={{ color: "#6b7280", mt: 0.5, lineHeight: 1.6 }}>
                                        {item.description}
                                    </Typography>
                                )}
                                {item.date && (
                                    <Typography variant="caption" sx={{ color: "#9ca3af", mt: 0.5, display: "block" }}>
                                        {formatDate(item.date)}
                                    </Typography>
                                )}
                                {idx < announcements.length - 1 && <Divider sx={{ my: 1.5 }} />}
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <EmptyState
                        icon={<CampaignOutlined sx={{ fontSize: 26, color: "#4f46e5" }} />}
                        title="No announcements"
                        subtitle="Company-wide notices and updates will appear here."
                    />
                )}
            </CardContent>
        </Card>
    );
}

export default AnnouncementsList;
