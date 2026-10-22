import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Card, CardContent, Typography, Box, Skeleton, Alert, Divider,
} from "@mui/material";
import { CampaignOutlined } from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import "../Admin/AdminDashboard.css";

import announcementServ from "../services/announcementService";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: CampaignOutlined },
    { key: "my-profile", label: "My Profile", icon: CampaignOutlined },
    { key: "my-attendance", label: "My Attendance", icon: CampaignOutlined },
    { key: "my-leaves", label: "My Leaves", icon: CampaignOutlined },
    { key: "my-payslips", label: "My Payslips", icon: CampaignOutlined },
];

function AnnouncementsPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [user, setUser] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch { setUser(null); }

        const fetchData = async () => {
            try {
                const { data } = await announcementServ.getRecent();
                setAnnouncements(data);
            } catch {
                // TODO: Backend API — GET /api/Announcements/recent
                setAnnouncements([]);
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

    const formatDate = (d) => {
        if (!d) return "";
        return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    return (
        <div className="dash-page emp-page">
            <Sidebar activeKey="my-dashboard" onLogout={handleLogout} title="HRMS" user={user} navItems={EMPLOYEE_NAV_ITEMS} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar userName={displayName} userRole={user?.role || "EMPLOYEE"} user={user} onLogout={handleLogout} collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
                <div className="dash-content">
                    <div className="emp-hero">
                        <div>
                            <h1>Announcements</h1>
                            <p>Company-wide notices and updates</p>
                        </div>
                        <span className="emp-hero-chip">
                            {announcements.length} {announcements.length === 1 ? "update" : "updates"}
                        </span>
                    </div>

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                    {loading ? (
                        <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                            <CardContent sx={{ p: 3 }}>
                                {[1, 2, 3, 4].map((i) => (
                                    <Box key={i} sx={{ mb: 2 }}>
                                        <Skeleton variant="text" width="60%" height={22} />
                                        <Skeleton variant="text" width="90%" height={16} />
                                        <Skeleton variant="text" width="30%" height={14} />
                                        {i < 4 && <Divider sx={{ mt: 1.5 }} />}
                                    </Box>
                                ))}
                            </CardContent>
                        </Card>
                    ) : announcements.length > 0 ? (
                        <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                            <CardContent sx={{ p: 3 }}>
                                {announcements.map((item, idx) => (
                                    <Box key={item.id || idx}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#171b2e" }}>
                                                {item.title}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: "#6b7280", mt: 0.5, lineHeight: 1.6 }}>
                                                {item.description}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "#9ca3af", mt: 0.5, display: "block" }}>
                                                {formatDate(item.date)}
                                            </Typography>
                                        </Box>
                                        {idx < announcements.length - 1 && <Divider sx={{ my: 2 }} />}
                                    </Box>
                                ))}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="body2" sx={{ color: "#9ca3af", textAlign: "center", py: 4 }}>
                                    No announcements at this time.
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AnnouncementsPage;
