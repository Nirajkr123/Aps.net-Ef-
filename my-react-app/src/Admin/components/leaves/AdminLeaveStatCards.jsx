import React from "react";
import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import {
    BeachAccessOutlined,
    CheckCircleRounded,
    CancelRounded,
    ScheduleRounded,
} from "@mui/icons-material";

import { CARD_SX } from "../../../Employee/components/leaves/leaveShared";

/* Admin ke 4 summary cards — Pending / Approved / Rejected / On Leave Today.
   Employee page ke cards se wahi visual language (CARD_SX + circular icon
   badge + tabular number), sirf data aur ek extra card alag.

   `On Leave Today` approved leave ranges me aaj ko ginte hue count karta
   hai — yaani "abhi kitne employees chhutte hue hain", jo requests
   approve/reject hone par turant badalta hai. */
const STAT_DEFS = [
    { key: "pending", label: "Pending", color: "#d97706", Icon: ScheduleRounded },
    { key: "approved", label: "Approved", color: "#059669", Icon: CheckCircleRounded },
    { key: "rejected", label: "Rejected", color: "#dc2626", Icon: CancelRounded },
    { key: "onLeaveToday", label: "On Leave Today", color: "#2563eb", Icon: BeachAccessOutlined },
];

function StatCard({ stat, value, loading, onSelect, active }) {
    const { label, color, Icon } = stat;

    return (
        <Card
            onClick={onSelect ? () => onSelect(stat.key) : undefined}
            role={onSelect ? "button" : undefined}
            aria-pressed={onSelect ? !!active : undefined}
            aria-label={onSelect ? `Filter requests by ${label}` : undefined}
            sx={{
                ...CARD_SX,
                height: "100%",
                cursor: onSelect ? "pointer" : "default",
                transition: "box-shadow .2s ease, transform .2s ease, border-color .2s ease",
                borderColor: active ? color : CARD_SX.border,
                boxShadow: active ? `0 6px 20px -8px ${color}66` : CARD_SX.boxShadow,
                "&:hover": onSelect
                    ? { transform: "translateY(-2px)", boxShadow: `0 10px 26px -10px ${color}66` }
                    : undefined,
            }}
        >
            <CardContent
                sx={{
                    p: { xs: 1.75, sm: 2.25 },
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 0.75,
                    "&:last-child": { pb: { xs: 1.75, sm: 2.25 } },
                }}
            >
                <Box
                    sx={{
                        width: { xs: 38, sm: 44 },
                        height: { xs: 38, sm: 44 },
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: `${color}14`,
                        color,
                        flexShrink: 0,
                    }}
                >
                    <Icon sx={{ fontSize: { xs: 19, sm: 22 } }} />
                </Box>

                {loading ? (
                    <Skeleton width={36} height={28} />
                ) : (
                    <Typography
                        sx={{
                            fontSize: { xs: 22, sm: 26 },
                            fontWeight: 800,
                            lineHeight: 1.1,
                            color,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {value}
                    </Typography>
                )}

                <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 600, lineHeight: 1.2, fontSize: { xs: 11, sm: 12.5 } }}
                >
                    {label}
                </Typography>
            </CardContent>
        </Card>
    );
}

function AdminLeaveStatCards({ stats, loading, activeKey, onSelect }) {
    return (
        <Box
            sx={{
                display: "grid",
                /* Mobile 2x2, md+ ek hi row me 4 cards. */
                gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
                gap: { xs: 1.5, md: 2 },
            }}
        >
            {STAT_DEFS.map((stat) => (
                <StatCard
                    key={stat.key}
                    stat={stat}
                    value={stats[stat.key] ?? 0}
                    loading={loading}
                    onSelect={onSelect}
                    active={!!onSelect && activeKey === stat.key}
                />
            ))}
        </Box>
    );
}

export default AdminLeaveStatCards;
