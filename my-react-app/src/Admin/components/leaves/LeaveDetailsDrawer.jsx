import React, { useEffect, useMemo, useState } from "react";
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Drawer,
    IconButton,
    LinearProgress,
    Tooltip,
    Typography,
    useMediaQuery,
} from "@mui/material";
import {
    BeachAccessOutlined,
    CalendarMonthOutlined,
    CancelRounded,
    CheckCircleRounded,
    CloseRounded,
    EventBusyOutlined,
} from "@mui/icons-material";

import leaveService from "../../../services/leaveService";
import {
    CARD_SX,
    formatDate,
    formatDateTime,
    formatRange,
    statusMeta,
    toBalanceView,
    typeColor,
} from "../../../Employee/components/leaves/leaveShared";

/* Ek chhota "label + value" row — drawer ka detail grid. */
function DetailRow({ label, value, tone }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography
                sx={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: ".4px",
                    textTransform: "uppercase",
                    color: "text.disabled",
                    mb: 0.35,
                }}
            >
                {label}
            </Typography>
            <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: tone || "text.primary", lineHeight: 1.4, wordBreak: "break-word" }}
            >
                {value}
            </Typography>
        </Box>
    );
}

/* Drawer ke andar ka ek section — heading + body. */
function Section({ title, icon, children, action }) {
    const Icon = icon;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                {Icon && <Icon sx={{ fontSize: 16, color: "text.disabled" }} />}
                <Typography
                    sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "text.secondary",
                        flex: 1,
                    }}
                >
                    {title}
                </Typography>
                {action}
            </Box>
            {children}
        </Box>
    );
}

/* Employee ki us type ka current balance — mini progress bar ke saath.
   Drawer me approve karne se pehle dekhne ke liye ki kitna bacha hai. */
function BalanceRow({ item }) {
    const color = typeColor(item.type);
    const pct = item.total > 0 ? (item.remaining / item.total) * 100 : 0;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }} noWrap>
                        {item.type}
                    </Typography>
                </Box>
                <Typography
                    variant="body2"
                    sx={{ fontWeight: 800, fontSize: 13, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
                >
                    {item.remaining}/{item.total}
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, pct))}
                sx={{
                    height: 4,
                    borderRadius: 3,
                    bgcolor: `${color}1a`,
                    "& .MuiLinearProgress-bar": { borderRadius: 3, bgcolor: color },
                }}
            />
        </Box>
    );
}

/* ---- Drawer -------------------------------------------------------------
   Mobile par bottom-sheet (full height, slide up), desktop par right se
   aata hua panel. Dono me content wahi hai.

   Drawer kholte hi do extra fetch hoti hain:
     · us employee ka current balance
     · us employee ki poori leave history
   (Ye sirf is employee ke liye hain, isliye list-level filters inhe
   affect nahi karte.) */
function LeaveDetailsDrawer({ open, leave, onClose, onApprove, onReject }) {
    const fullHeight = useMediaQuery((theme) => theme.breakpoints.down("sm"));
    const [balance, setBalance] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !leave) return;

        let cancelled = false;
        setLoading(true);

        Promise.all([
            leaveService.getEmployeeBalance(leave.employeeId),
            leaveService.getEmployeeLeaves(leave.employeeId),
        ])
            .then(([b, h]) => {
                if (cancelled) return;
                setBalance(b);
                setHistory(h);
            })
            .catch(() => {
                /* Detail fetch fail ho to drawer khali na lage — list ka
                   data to dikh raha hai hi. */
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, leave]);

    const balanceView = useMemo(() => toBalanceView(balance), [balance]);

    /* Clicked record ke alawa ki history — "past leaves". Current record
       list me already hai, isliye yahan filter kar dete hain. */
    const pastLeaves = useMemo(
        () => (leave ? history.filter((l) => l.id !== leave.id).slice(0, 6) : []),
        [history, leave]
    );

    if (!leave) return null;

    const status = statusMeta(leave.status);
    const initials = (leave.employeeName || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("");

    const isPending = leave.status === "Pending";

    return (
        <Drawer
            anchor={fullHeight ? "bottom" : "right"}
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: {
                        width: { xs: "100%", sm: 440 },
                        maxWidth: "100%",
                        /* Mobile par full-height bottom sheet; desktop par
                           poora panel height. Koi fixed height nahi. */
                        maxHeight: { xs: "92dvh", sm: "100%" },
                        borderRadius: fullHeight ? { xs: 4, sm: 0 } : 0,
                        display: "flex",
                        flexDirection: "column",
                    },
                },
            }}
        >
            {/* ---- Header ---- */}
            <Box
                sx={{
                    px: { xs: 2, sm: 2.5 },
                    pt: 2.5,
                    pb: 2,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    flexShrink: 0,
                    borderBottom: "1px solid #eef0f7",
                }}
            >
                <Avatar sx={{ bgcolor: typeColor(leave.type), fontWeight: 800, fontSize: 15, width: 44, height: 44 }}>
                    {initials}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.25 }} noWrap>
                        {leave.employeeName}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5, flexWrap: "wrap" }}>
                        <Chip
                            label={leave.status}
                            size="small"
                            color={status.color}
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: 12, height: 24 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            #{leave.id}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} size="small" aria-label="Close details" sx={{ color: "text.secondary" }}>
                    <CloseRounded fontSize="small" />
                </IconButton>
            </Box>

            {/* ---- Body (scrollable) ---- */}
            <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 2, sm: 2.5 }, py: 2.25, display: "flex", flexDirection: "column", gap: 2.5 }}>
                {/* Leave ka detail */}
                <Section title="Request" icon={CalendarMonthOutlined}>
                    <Box
                        sx={{
                            ...CARD_SX,
                            p: 1.75,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                        }}
                    >
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                            <DetailRow label="Leave type" value={leave.type} tone={typeColor(leave.type)} />
                            <DetailRow
                                label="Total days"
                                value={`${leave.days} ${leave.days === 1 ? "day" : "days"}`}
                            />
                            <DetailRow label="From" value={formatDate(leave.from)} />
                            <DetailRow label="To" value={formatDate(leave.to)} />
                            <DetailRow label="Applied on" value={formatDateTime(leave.appliedOn)} />
                            <DetailRow
                                label="Reviewed by"
                                value={leave.reviewedBy || "Not reviewed yet"}
                                tone={leave.reviewedBy ? "text.primary" : "text.disabled"}
                            />
                        </Box>

                        <Divider />

                        <Box>
                            <Typography
                                sx={{
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    letterSpacing: ".4px",
                                    textTransform: "uppercase",
                                    color: "text.disabled",
                                    mb: 0.5,
                                }}
                            >
                                Reason
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.55 }}>
                                {leave.reason}
                            </Typography>
                        </Box>

                        {leave.adminComment && (
                            <Box
                                sx={{
                                    px: 1.4,
                                    py: 1.15,
                                    borderRadius: 2.5,
                                    bgcolor: "#fef2f2",
                                    border: "1px solid #fecaca",
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        letterSpacing: ".4px",
                                        textTransform: "uppercase",
                                        color: "#b91c1c",
                                        mb: 0.4,
                                    }}
                                >
                                    Admin comment
                                </Typography>
                                <Typography variant="body2" sx={{ color: "#991b1b", lineHeight: 1.5 }}>
                                    {leave.adminComment}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Section>

                {/* Us employee ka abhi ka balance */}
                <Section title="Current balance" icon={BeachAccessOutlined}>
                    {loading ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2" color="text.secondary">
                                Loading balance…
                            </Typography>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                ...CARD_SX,
                                p: 1.75,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.4,
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                                <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                                    {balanceView.remaining}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    / {balanceView.total} days left
                                </Typography>
                            </Box>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
                                {balanceView.breakdown.map((item) => (
                                    <BalanceRow key={item.type} item={item} />
                                ))}
                            </Box>
                        </Box>
                    )}
                </Section>

                {/* Us employee ki purani requests */}
                <Section title="Past leave requests" icon={EventBusyOutlined}>
                    {loading ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2" color="text.secondary">
                                Loading history…
                            </Typography>
                        </Box>
                    ) : pastLeaves.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            This is the only leave request from {leave.employeeName?.split(" ")[0]} so far.
                        </Typography>
                    ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {pastLeaves.map((l) => {
                                const m = statusMeta(l.status);
                                return (
                                    <Box
                                        key={l.id}
                                        sx={{
                                            ...CARD_SX,
                                            p: 1.4,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1.25,
                                            borderLeft: `3px solid ${m.colorValue}`,
                                        }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }} noWrap>
                                                {l.type} · {formatRange(l.from, l.to)}
                                            </Typography>
                                            <Tooltip title={l.reason} arrow>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                                >
                                                    {l.reason}
                                                </Typography>
                                            </Tooltip>
                                        </Box>
                                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                                            <Chip
                                                label={l.status}
                                                size="small"
                                                color={m.color}
                                                variant="outlined"
                                                sx={{ fontWeight: 700, fontSize: 11, height: 22 }}
                                            />
                                            <Typography
                                                variant="caption"
                                                sx={{ display: "block", color: "text.disabled", fontWeight: 700, fontSize: 11 }}
                                            >
                                                {l.days} {l.days === 1 ? "day" : "days"}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </Section>
            </Box>

            {/* ---- Footer: actions (sirf Pending par) ---- */}
            {isPending && (
                <Box
                    sx={{
                        px: { xs: 2, sm: 2.5 },
                        py: 1.75,
                        display: "flex",
                        gap: 1,
                        flexShrink: 0,
                        borderTop: "1px solid #eef0f7",
                        bgcolor: "#fcfdff",
                    }}
                >
                    <Button
                        variant="outlined"
                        onClick={onReject}
                        startIcon={<CancelRounded sx={{ fontSize: "18px !important" }} />}
                        sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            minHeight: 44,
                            flex: 1,
                            borderRadius: 2.5,
                            color: "#dc2626",
                            borderColor: "#fecaca",
                            "&:hover": { bgcolor: "#fef2f2", borderColor: "#fca5a5" },
                        }}
                    >
                        Reject
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={onApprove}
                        startIcon={<CheckCircleRounded sx={{ fontSize: "18px !important" }} />}
                        sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            minHeight: 44,
                            flex: 1,
                            borderRadius: 2.5,
                            boxShadow: "0 8px 20px -8px rgba(5,150,105,0.6)",
                        }}
                    >
                        Approve
                    </Button>
                </Box>
            )}
        </Drawer>
    );
}

export default LeaveDetailsDrawer;
