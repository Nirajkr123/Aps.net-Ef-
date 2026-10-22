import React from "react";
import { Box, Card, CardContent, Skeleton, Tooltip, Typography } from "@mui/material";
import { TrendingUpOutlined } from "@mui/icons-material";

import { CARD_SX, INDIGO, statusMeta } from "./leaveShared";

/* Stacking order — Approved sabse upar, Rejected sabse neeche. Taki
   har bar me "kitne approve hue, kitne abhi pending" ek nazar me pada. */
const STATUS_ORDER = ["Approved", "Pending", "Rejected"];

/* Pichhle 6 mahine ka trend. Har mahine ka apna total + status-wise
   count — graph aur legend dono yahin se aate hain, isliye numbers
   hamesha bars ke saath match karte hain.
   `from` se `slice(0, 7)` compare hota hai (keys `YYYY-MM` hote hain). */
const buildTrend = (leaves) => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const inMonth = (leaves || []).filter(
            (l) => (l.from ? String(l.from).slice(0, 7) : "") === key
        );
        const counts = STATUS_ORDER.reduce((acc, status) => {
            acc[status] = inMonth.filter((l) => l.status === status).length;
            return acc;
        }, {});

        months.push({
            key,
            /* Saal ke paar wale mahine (jaise "Oct '25") me saal ka
               chhota hissa bhi — warna 6 mahine ki window me sirf
               "Oct" dekh kar saal andaza nahi lagta. */
            label: d.toLocaleDateString("en-IN", { month: "short" }),
            fullLabel: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
            isCurrentYear: d.getFullYear() === now.getFullYear(),
            isCurrentMonth: i === 0,
            counts,
            total: Object.values(counts).reduce((sum, n) => sum + n, 0),
        });
    }
    return months;
};

function MonthlyRequestsChart({ leaves, loading }) {
    const data = buildTrend(leaves);
    const periodTotal = data.reduce((sum, m) => sum + m.total, 0);
    const periodCounts = STATUS_ORDER.reduce((acc, status) => {
        acc[status] = data.reduce((sum, m) => sum + m.counts[status], 0);
        return acc;
    }, {});
    const busiest = data.reduce((best, m) => (m.total > (best?.total ?? 0) ? m : best), null);

    /* "Nice" axis: gridlines ki sankhya 2 se 5 ke beech rehti hai aur tick
       labels poore numbers (2, 4, 6 …) rehte hain. Pehle fixed 4 step
       rakhne se chhote data (peak 2) me bars sirf aadhe plot tak pahunchte
       the — axis ab peak ke gird chipakti hai. */
    const peak = Math.max(...data.map((m) => m.total), 1);
    const step = peak <= 4 ? 1 : Math.ceil(peak / 4);
    const axisMax = step * Math.ceil(peak / step);
    const ticks = Array.from({ length: axisMax / step }, (_, i) => axisMax - i * step);

    /* Ek bar ke andar ka tooltip: mahine ka naam + status-wise hissa. */
    const tooltipFor = (m) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.35, py: 0.25 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, mb: 0.25 }}>{m.fullLabel}</Typography>
            {STATUS_ORDER.map((status) => (
                <Box key={status} sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: statusMeta(status).colorValue }} />
                    <Typography sx={{ fontSize: 11.5 }}>{status}</Typography>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800, ml: "auto" }}>
                        {m.counts[status]}
                    </Typography>
                </Box>
            ))}
        </Box>
    );

    return (
        <Card sx={{ ...CARD_SX, height: "100%" }}>
            <CardContent
                sx={{
                    p: { xs: 2, md: 2.5 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    "&:last-child": { pb: { xs: 2, md: 2.5 } },
                }}
            >
                {/* ---- Header: title + caption ----
                    `flexWrap` zaroori hai — chhote width par "Last 6 months"
                    apni line par gir jaata hai, title shrink/clip nahi hota. */}
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 0.5,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
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
                            <TrendingUpOutlined sx={{ fontSize: 18 }} />
                        </Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }} noWrap>
                            Monthly Requests
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
                        Last 6 months
                    </Typography>
                </Box>

                {/* ---- Legend: bars ka matlab ----
                    Bina iske stacked colours ka koi sense nahi banta, isliye
                    har status ke saath uska count bhi. */}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1, md: 1.75 } }}>
                    {STATUS_ORDER.map((status) => {
                        const { colorValue } = statusMeta(status);
                        return (
                            <Box key={status} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                                <Box
                                    sx={{ width: 9, height: 9, borderRadius: 2.5, bgcolor: colorValue, flexShrink: 0 }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{ color: "text.secondary", fontWeight: 600, fontSize: 11.5 }}
                                >
                                    {status}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{ color: "text.primary", fontWeight: 800, fontSize: 11.5, lineHeight: 1 }}
                                >
                                    {periodCounts[status]}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>

                {/* Chart ko koi fixed height nahi di — `minHeight` + flex
                    stretch se plot apne hisse ka poora area use karta hai.
                    Pehle yahan `height: 160` + `overflow: hidden` tha, jisse
                    bars aur labels clip ho rahe the. */}
                {loading ? (
                    /* Skeleton ke liye height fix hai (sirf placeholder hai);
                       asli chart ke Box par `minHeight` + flex stretch hai. */
                    <Box sx={{ height: { xs: 200, md: 260 }, display: "flex", alignItems: "flex-end", gap: 2, px: 1 }}>
                        {data.map((d, i) => (
                            <Skeleton
                                key={d.key}
                                variant="rounded"
                                sx={{ flex: 1, height: `${35 + ((i * 17) % 50)}%`, maxWidth: 34, borderRadius: 2 }}
                            />
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", minHeight: { xs: 200, md: 260 } }}>
                        {/* ---- Plot area (y-axis + gridlines + bars) ----
                            `mt: 2.5` upar jagah deta hai, taaki sabse
                            bhari bar ke upar wala number header/legend se
                            na takraye. */}
                        <Box sx={{ position: "relative", flex: 1, minHeight: 0, ml: 3, mr: 0.5, mt: 2.5 }}>
                            {ticks.map((t) => (
                                <Box
                                    key={t}
                                    sx={{
                                        position: "absolute",
                                        left: 0,
                                        right: 0,
                                        top: `${(t / axisMax) * 100}%`,
                                        borderTop: t === 0 ? "1px solid #e4e7f1" : "1px dashed #edf0f7",
                                        pointerEvents: "none",
                                    }}
                                />
                            ))}

                            {ticks.map((t) => (
                                <Typography
                                    key={`label-${t}`}
                                    sx={{
                                        position: "absolute",
                                        right: "100%",
                                        mr: 1,
                                        top: `${(t / axisMax) * 100}%`,
                                        transform: "translateY(-50%)",
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        color: "#b6bcd0",
                                        lineHeight: 1,
                                        pointerEvents: "none",
                                    }}
                                >
                                    {t}
                                </Typography>
                            ))}

                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "flex-end",
                                    gap: { xs: 1, md: 2 },
                                }}
                            >
                                {data.map((m) => {
                                    const totalPct = (m.total / axisMax) * 100;
                                    /* Sirf non-zero segments render — khali
                                       jagah ka grey stub har bar me dikhta. */
                                    const segments = STATUS_ORDER.map((status) => ({
                                        status,
                                        count: m.counts[status],
                                        pct: (m.counts[status] / axisMax) * 100,
                                    })).filter((s) => s.count > 0);

                                    return (
                                        <Tooltip key={m.key} arrow title={tooltipFor(m)}>
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    height: "100%",
                                                    position: "relative",
                                                    display: "flex",
                                                    alignItems: "flex-end",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {/* Bar ka total — upar absolute,
                                                    isliye gridlines se alignment
                                                    nahi bigadti. */}
                                                {m.total > 0 && (
                                                    <Typography
                                                        sx={{
                                                            position: "absolute",
                                                            bottom: `calc(${totalPct}% + 4px)`,
                                                            left: 0,
                                                            right: 0,
                                                            textAlign: "center",
                                                            fontSize: 11.5,
                                                            fontWeight: 800,
                                                            lineHeight: 1,
                                                            color: INDIGO,
                                                            pointerEvents: "none",
                                                        }}
                                                    >
                                                        {m.total}
                                                    </Typography>
                                                )}

                                                <Box
                                                    sx={{
                                                        width: "100%",
                                                        maxWidth: { xs: 22, md: 34 },
                                                        /* `height: 100%` zaroori hai — segments
                                                           ki `%` height resolve hi tab hoti
                                                           hai jab parent ki definite height ho. */
                                                        height: "100%",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        justifyContent: "flex-end",
                                                    }}
                                                >
                                                    {m.total === 0 ? (
                                                        <Box
                                                            sx={{
                                                                height: 4,
                                                                borderRadius: 2,
                                                                bgcolor: "#eef0f6",
                                                            }}
                                                        />
                                                    ) : (
                                                        segments.map((s, i) => {
                                                            const { colorValue } = statusMeta(s.status);
                                                            const isTop = i === 0;
                                                            const isBottom = i === segments.length - 1;
                                                            return (
                                                                <Box
                                                                    key={s.status}
                                                                    sx={{
                                                                        height: `${s.pct}%`,
                                                                        bgcolor: colorValue,
                                                                        borderTopLeftRadius: isTop ? 8 : 0,
                                                                        borderTopRightRadius: isTop ? 8 : 0,
                                                                        borderBottomLeftRadius: isBottom ? 3 : 0,
                                                                        borderBottomRightRadius: isBottom ? 3 : 0,
                                                                        boxShadow: isTop ? `0 6px 14px -8px ${colorValue}` : "none",
                                                                    }}
                                                                />
                                                            );
                                                        })
                                                    )}
                                                </Box>
                                            </Box>
                                        </Tooltip>
                                    );
                                })}
                            </Box>
                        </Box>

                        {/* ---- X axis labels (same gap/flex = bars ke saath aligned) ---- */}
                        <Box sx={{ display: "flex", gap: { xs: 1, md: 2 }, mt: 1, ml: 3, mr: 0.5 }}>
                            {data.map((m) => (
                                <Typography
                                    key={m.key}
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "center",
                                        fontSize: { xs: 10.5, md: 12 },
                                        fontWeight: m.isCurrentMonth ? 800 : 600,
                                        color: m.isCurrentMonth ? INDIGO : "text.secondary",
                                    }}
                                >
                                    {m.label}
                                    {!m.isCurrentYear && (
                                        <Box component="span" sx={{ display: "block", fontSize: 9.5, opacity: 0.75 }}>
                                            {/* key `YYYY-MM` hai — saal ka chhota hissa yahin se */}
                                            &apos;{m.key.slice(2, 4)}
                                        </Box>
                                    )}
                                </Typography>
                            ))}
                        </Box>

                        {/* ---- Summary: 6 mahine ka hisaab ---- */}
                        <Typography
                            variant="caption"
                            sx={{ mt: 1.25, color: "text.secondary", fontWeight: 600, fontSize: 12 }}
                        >
                            {periodTotal > 0 ? (
                                <>
                                    {periodTotal} {periodTotal === 1 ? "request" : "requests"} in the last 6 months
                                    {busiest?.total > 0 && ` · busiest month ${busiest.fullLabel} (${busiest.total})`}
                                </>
                            ) : (
                                "No leave requests in the last 6 months"
                            )}
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export default MonthlyRequestsChart;
