import React from "react";
import { useNavigate } from "react-router-dom";
import {
    Card, CardContent, Typography, Box, Divider, Skeleton, Button,
} from "@mui/material";
import { EventOutlined, Add } from "@mui/icons-material";

import useIsMobile from "../../hooks/useIsMobile";
import { useLeave } from "../../context/LeaveContext";
import { LEAVE_TYPE_COLORS, toBalanceView } from "./leaves/leaveShared";

function LeaveBalanceCard() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    /* Balance LeaveContext se — dashboard aur My Leaves page dono ka number
       ek hi source se aata hai, to approval ke baad dono jagah turant
       update ho jaate hain (pehle yahan apna alag fetch tha, jisne naya
       shape par `undefined` dikhaya). */
    const { balance, loading } = useLeave();
    const view = balance ? toBalanceView(balance) : null;
    const usedPct = view && view.total > 0 ? (view.used / view.total) * 100 : 0;
    // Mobile pe donut chhota, warna stats neeche wrap hokar card lamba kar dete hain
    const donutSize = isMobile ? 60 : 84;
    const donutRadius = isMobile ? 24 : 34;
    const donutCenter = donutSize / 2;
    const donutStroke = 6;
    const donutCircumference = 2 * Math.PI * donutRadius;
    const donutUsedOffset = donutCircumference - (usedPct / 100) * donutCircumference;

    return (
        <Card sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            height: "100%",
            borderLeft: "4px solid #059669",
            display: "flex", flexDirection: "column",
            transition: "all 0.3s ease",
            "&:hover": { boxShadow: "0 8px 30px rgba(16,185,129,0.15)", transform: "translateY(-2px)" },
        }}>
            <CardContent sx={{ p: 2.8, flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1, fontSize: 16 }}>
                        <EventOutlined sx={{ color: "#059669" }} />
                        Leave Balance
                    </Typography>
                </Box>

                {loading ? (
                    <Box>
                        <Skeleton variant="circular" width={84} height={84} />
                        <Skeleton variant="text" width="60%" height={24} sx={{ mt: 2 }} />
                    </Box>
                ) : view ? (
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        {/* Donut + Stats */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 }, mb: { xs: 0.75, sm: 1.5 }, flexWrap: "wrap", justifyContent: "space-between" }}>
                            <Box sx={{ position: "relative", width: donutSize, height: donutSize, flexShrink: 0 }}>
                                <svg width={donutSize} height={donutSize} style={{ transform: "rotate(-90deg)" }}>
                                    <circle cx={donutCenter} cy={donutCenter} r={donutRadius} fill="none" stroke="#f3f4f6" strokeWidth={donutStroke} />
                                    <circle cx={donutCenter} cy={donutCenter} r={donutRadius} fill="none" stroke="#059669" strokeWidth={donutStroke} strokeLinecap="round"
                                        strokeDasharray={donutCircumference} strokeDashoffset={donutUsedOffset}
                                        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
                                </svg>
                                <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <Typography variant="h4" sx={{ fontWeight: 800, color: "#171b2e", lineHeight: 1, fontSize: { xs: 19, sm: 26 } }}>{view.remaining}</Typography>
                                    <Typography variant="caption" sx={{ color: "#9ca3af", fontSize: { xs: 8.5, sm: 10 }, fontWeight: 500 }}>left</Typography>
                                </Box>
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.9 }}>
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    <Box sx={{ flex: 1, bgcolor: "#ecfdf5", borderRadius: 2, p: { xs: 0.5, sm: 0.8 }, textAlign: "center", border: "1px solid #a7f3d0", minWidth: 0 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: "#059669", lineHeight: 1.2, fontSize: { xs: 14, sm: 18 } }}>{view.remaining}</Typography>
                                        <Typography variant="caption" sx={{ color: "#6b7280", fontSize: { xs: 7.5, sm: 8.5 }, fontWeight: 600, textTransform: "uppercase" }}>Available</Typography>
                                    </Box>
                                    <Box sx={{ flex: 1, bgcolor: "#fef2f2", borderRadius: 2, p: { xs: 0.5, sm: 0.8 }, textAlign: "center", border: "1px solid #fecaca", minWidth: 0 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: "#dc2626", lineHeight: 1.2, fontSize: { xs: 14, sm: 18 } }}>{view.used}</Typography>
                                        <Typography variant="caption" sx={{ color: "#6b7280", fontSize: { xs: 7.5, sm: 8.5 }, fontWeight: 600, textTransform: "uppercase" }}>Used</Typography>
                                    </Box>
                                </Box>

                                {/* Progress Bar */}
                                <Box>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
                                        <Typography variant="caption" sx={{ color: "#6b7280", fontSize: 10 }}>{view.used}/{view.total} used</Typography>
                                        <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 600, fontSize: 10 }}>{Math.round(usedPct)}%</Typography>
                                    </Box>
                                    <Box sx={{ height: 5, bgcolor: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                                        <Box sx={{ width: `${usedPct}%`, height: "100%", bgcolor: usedPct > 70 ? "#dc2626" : "#059669", borderRadius: 3, transition: "width 0.8s ease" }} />
                                    </Box>
                                </Box>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: { xs: 0.75, sm: 1.5 } }} />

                        {/* Breakdown */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 0.6, sm: 1 }, mb: { xs: 0.75, sm: 1.5 }, flex: 1 }}>
                            {view.breakdown?.map((item) => {
                                const itemPct = item.total > 0 ? (item.used / item.total) * 100 : 0;
                                return (
                                    <Box key={item.type} sx={{
                                        display: "flex", alignItems: "center", gap: 1.5, p: 0.6, borderRadius: 1.5,
                                        transition: "all 0.2s ease", "&:hover": { bgcolor: "#f9fafb" },
                                    }}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: LEAVE_TYPE_COLORS[item.type] || "#6b7280", flexShrink: 0 }} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600, color: "#374151", fontSize: 12 }}>{item.type}</Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: "#171b2e", fontSize: 12 }}>{item.remaining}/{item.total}</Typography>
                                            </Box>
                                            <Box sx={{ height: 3, bgcolor: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                                                <Box sx={{ width: `${100 - itemPct}%`, height: "100%", bgcolor: LEAVE_TYPE_COLORS[item.type] || "#6b7280", borderRadius: 2 }} />
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>

                        {/* Apply Button */}
                        <Button variant="contained" fullWidth startIcon={<Add />} onClick={() => navigate("/my-leaves")}
                            sx={{
                                textTransform: "none", fontWeight: 700, borderRadius: 2, py: 1.1, fontSize: 13,
                                background: "linear-gradient(135deg, #059669, #10b981)",
                                boxShadow: "0 8px 20px -6px rgba(5,150,105,0.5)",
                                "&:hover": { background: "linear-gradient(135deg, #047857, #059669)", boxShadow: "0 12px 28px -6px rgba(5,150,105,0.6)", transform: "translateY(-1px)" },
                            }}>
                            Apply Leave
                        </Button>
                    </Box>
                ) : (
                    <Typography variant="body2" sx={{ color: "#9ca3af", py: 2, textAlign: "center" }}>No leave balance data available.</Typography>
                )}
            </CardContent>
        </Card>
    );
}

export default LeaveBalanceCard;
