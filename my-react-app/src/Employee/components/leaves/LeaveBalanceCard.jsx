import React from "react";
import {
    Box,
    Card,
    CardContent,
    Divider,
    LinearProgress,
    Skeleton,
    Typography,
} from "@mui/material";
import { CalendarMonthOutlined, InfoOutlined } from "@mui/icons-material";

import { CARD_SX, INDIGO, typeColor, toBalanceView } from "./leaveShared";

/* Ek leave type ki row — dot + naam + "remaining/total" + usi colour
   ka patla progress bar. */
function BalanceRow({ item }) {
    const color = typeColor(item.type);
    const pct = item.total > 0 ? (item.remaining / item.total) * 100 : 0;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, minWidth: 0 }}>
                    <Box
                        sx={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            bgcolor: color,
                            flexShrink: 0,
                        }}
                    />
                    <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: "text.primary", fontSize: 13.5 }}
                        noWrap
                    >
                        {item.type}
                    </Typography>
                </Box>
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 700,
                        color: "text.primary",
                        fontSize: 13.5,
                        fontVariantNumeric: "tabular-nums",
                        flexShrink: 0,
                    }}
                >
                    {item.remaining}/{item.total}
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, pct))}
                sx={{
                    height: 5,
                    borderRadius: 3,
                    bgcolor: `${color}1a`,
                    "& .MuiLinearProgress-bar": { borderRadius: 3, bgcolor: color },
                }}
            />
        </Box>
    );
}

/* Leave Balance card — top section ke right column me poori height leta hai
   (left column = stat cards + chart), isliye `height: 100%` + andar
   flex column: list neeche push hoti rehti hai, koi gap nahi banta. */
function LeaveBalanceCard({ balance, loading, pendingDays = 0 }) {
    /* Service ka `{ Casual:{total,used}, ... }` shape → cards wala view
       (`{ total, used, remaining, breakdown[] }`). Ye conversion ek hi
       jagah (leaveShared) hoti hai, taaki har card ke numbers ek jaise
       rahen. Admin approve karte hi context ka `balance` badalta hai →
       yahan `used` badhta, `remaining` ghatta, progress bars update. */
    const view = toBalanceView(balance);
    const total = view.total;
    const remaining = view.remaining;
    const used = view.used;
    const overallPct = total > 0 ? (remaining / total) * 100 : 0;

    return (
        <Card sx={{ ...CARD_SX, height: "100%", display: "flex", flexDirection: "column" }}>
            <CardContent
                sx={{
                    p: { xs: 2, md: 2.5 },
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    "&:last-child": { pb: { xs: 2, md: 2.5 } },
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "#eef0ff",
                            color: INDIGO,
                            flexShrink: 0,
                        }}
                    >
                        <CalendarMonthOutlined sx={{ fontSize: 18 }} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
                        Leave Balance
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0.5 }}>
                        <Skeleton width={140} height={44} />
                        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 4 }} />
                        <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 2 }} />
                    </Box>
                ) : (
                    <>
                        {/* ---- Bada number = baaki (remaining) days ---- */}
                        <Box>
                            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
                                <Typography
                                    sx={{
                                        fontSize: { xs: 34, md: 40 },
                                        fontWeight: 800,
                                        lineHeight: 1,
                                        color: "text.primary",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {remaining}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ color: "text.secondary", fontWeight: 600 }}
                                >
                                    / {total} days remaining
                                </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                                Used: {used} {used === 1 ? "day" : "days"}
                            </Typography>
                        </Box>

                        {/* ---- Overall progress ---- */}
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, Math.max(0, overallPct))}
                            aria-label="Overall leave balance used"
                            sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: "#eef0ff",
                                "& .MuiLinearProgress-bar": {
                                    borderRadius: 4,
                                    bgcolor: INDIGO,
                                    transition: "transform .6s ease",
                                },
                            }}
                        />

                        <Divider />

                        {/* ---- Har type ka apna hissa ---- */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                            {view.breakdown.map((item) => (
                                <BalanceRow key={item.type} item={item} />
                            ))}
                        </Box>

                        {/* ---- Footer: `mt: auto` se card ke bottom tak chipak
                            jaata hai. Left column (stats + chart) left column
                            se lamba hota hai, to bina is note ke card ke neeche
                            khali panel reh jaata. Ye wahi data hai jo history
                            me dikhta hai — pending days abhi balance me katte
                            nahi, ye batana zaroori hai. ---- */}
                        {pendingDays > 0 && (
                            <Box
                                sx={{
                                    mt: "auto",
                                    pt: 1.5,
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 0.9,
                                    px: 1.4,
                                    py: 1.15,
                                    borderRadius: 2.5,
                                    bgcolor: "#fffbeb",
                                    border: "1px solid #fde68a",
                                }}
                            >
                                <InfoOutlined sx={{ fontSize: 16, color: "#d97706", mt: "1px", flexShrink: 0 }} />
                                <Typography
                                    variant="caption"
                                    sx={{ color: "#92400e", fontWeight: 600, lineHeight: 1.4, fontSize: 11.5 }}
                                >
                                    {pendingDays} {pendingDays === 1 ? "day is" : "days are"} pending approval, so not
                                    deducted yet.
                                </Typography>
                            </Box>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default LeaveBalanceCard;
