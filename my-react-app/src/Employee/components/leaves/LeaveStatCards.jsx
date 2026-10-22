import React from "react";
import { Box, Card, CardContent, Grid, Skeleton, Typography } from "@mui/material";
import {
    EventAvailableOutlined,
    CheckCircleRounded,
    ScheduleRounded,
    CancelRounded,
} from "@mui/icons-material";

import { CARD_SX } from "./leaveShared";

/* Chaar summary cards — Total / Approved / Pending / Rejected.
   Icon ka colour hi card ka accent hai, isliye definition ek jagah. */
const STAT_DEFS = [
    { key: "total", label: "Total Leaves", color: "#4f46e5", Icon: EventAvailableOutlined },
    { key: "approved", label: "Approved", color: "#059669", Icon: CheckCircleRounded },
    { key: "pending", label: "Pending", color: "#d97706", Icon: ScheduleRounded },
    { key: "rejected", label: "Rejected", color: "#dc2626", Icon: CancelRounded },
];

function StatCard({ stat, value, loading, active, onSelect }) {
    const { label, color, Icon } = stat;

    return (
        <Card
            onClick={onSelect ? () => onSelect(stat.key) : undefined}
            role={onSelect ? "button" : undefined}
            aria-pressed={onSelect ? !!active : undefined}
            aria-label={onSelect ? `Filter leave history by ${label}` : undefined}
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

/* Mobile par 2x2, `sm` aur usse upar ek hi row me chaar cards.
   `onSelect` diya ho to card clickable hai aur `activeKey` se pata chalta
   hai kaun sa filter abhi laga hua hai. */
function LeaveStatCards({ stats, loading, activeKey, onSelect }) {
    return (
        <Grid container spacing={{ xs: 1.5, md: 2 }}>
            {STAT_DEFS.map((stat) => (
                <Grid key={stat.key} size={{ xs: 6, sm: 3 }}>
                    <StatCard
                        stat={stat}
                        value={stats[stat.key]}
                        loading={loading}
                        active={!!onSelect && activeKey === stat.key}
                        onSelect={onSelect}
                    />
                </Grid>
            ))}
        </Grid>
    );
}

export default LeaveStatCards;
