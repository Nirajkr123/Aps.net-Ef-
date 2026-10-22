import React, { useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Collapse,
    Divider,
    IconButton,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import { AddRounded, CancelOutlined, EventBusyOutlined } from "@mui/icons-material";

import {
    CARD_SX,
    HISTORY_FILTERS,
    INDIGO,
    INDIGO_DARK,
    formatDate,
    formatDateShort,
    statusMeta,
    typeColor,
} from "./leaveShared";

/* Stat card click karne par history section ko scroll karne ke liye —
   page is id ko `getElementById` se pakadta hai. */
export const HISTORY_ANCHOR_ID = "leave-history";

/* Type ka coloured dot + naam — table aur mobile card dono me same. */
function TypeLabel({ type }) {
    const color = typeColor(type);
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, minWidth: 0 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13.5 }} noWrap>
                {type}
            </Typography>
        </Box>
    );
}

function StatusChip({ status }) {
    const meta = statusMeta(status);
    return (
        <Chip
            label={status}
            size="small"
            color={meta.color}
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: 12.5, height: 26 }}
        />
    );
}

/* ---- Admin comment (sirf REJECTED rows) --------------------------------
   Rejection ka reason default tooltips me chhupa nahi rehta — full text
   row ke neeche expandable panel me khulta hai, to user ko pehle expand
   karna padta hai. Chhoti screen par us row ka reason hi 2 line me clip
   hota, isliye wahan bhi ye button zaroori hai. */
function AdminComment({ comment, compact = false }) {
    const [open, setOpen] = useState(false);
    if (!comment) return null;

    return (
        <Box sx={{ mt: compact ? 0.25 : 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                <Tooltip title={open ? "Hide admin comment" : "View admin comment"}>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen((v) => !v);
                        }}
                        size="small"
                        aria-label={open ? "Hide admin comment" : "View admin comment"}
                        aria-expanded={open}
                        sx={{
                            color: "#dc2626",
                            p: 0.25,
                            bgcolor: open ? "#fef2f2" : "transparent",
                            "&:hover": { bgcolor: "#fef2f2" },
                        }}
                    >
                        <CancelOutlined sx={{ fontSize: 15 }} />
                    </IconButton>
                </Tooltip>
                <Typography
                    variant="caption"
                    sx={{ color: "#dc2626", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                    onClick={() => setOpen((v) => !v)}
                    noWrap
                >
                    {open ? "Hide comment" : "View comment"}
                </Typography>
            </Box>

            <Collapse in={open} unmountOnExit>
                <Box
                    sx={{
                        mt: 0.75,
                        px: 1.1,
                        py: 0.8,
                        borderRadius: 2,
                        bgcolor: "#fef2f2",
                        border: "1px solid #fecaca",
                        maxWidth: compact ? "100%" : 320,
                    }}
                >
                    <Typography sx={{ fontSize: 12, color: "#991b1b", lineHeight: 1.45, whiteSpace: "normal" }}>
                        {comment}
                    </Typography>
                </Box>
            </Collapse>
        </Box>
    );
}

/* Sirf Pending request cancel ho sakti hai. */
function CancelButton({ onCancel, label = "Cancel" }) {
    return (
        <Button
            onClick={onCancel}
            size="small"
            startIcon={<CancelOutlined sx={{ fontSize: "18px !important" }} />}
            sx={{
                textTransform: "none",
                fontWeight: 700,
                color: "#dc2626",
                minWidth: 40,
                minHeight: 40,
                px: 1.25,
                "&:hover": { bgcolor: "#fef2f2" },
            }}
        >
            {label}
        </Button>
    );
}

/* ---- Desktop: MUI Table (md aur upar) --------------------------------- */

function LeaveTable({ leaves, onCancel }) {
    return (
        <TableContainer className="emp-leave-table-wrap">
            <Table className="emp-leave-table" size="small">
                <TableHead>
                    <TableRow sx={{ bgcolor: "#fafbfe" }}>
                        {["Type", "From", "To", "Days", "Reason", "Status", ""].map((head, i) => (
                            <TableCell
                                key={head || `action-${i}`}
                                align={i === 3 ? "center" : "left"}
                                sx={{
                                    fontWeight: 800,
                                    color: "text.secondary",
                                    fontSize: 12,
                                    textTransform: "uppercase",
                                    letterSpacing: ".5px",
                                    py: 1.5,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {head}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {leaves.map((leave) => (
                        <TableRow
                            key={leave.id}
                            hover
                            sx={{
                                "&:last-child td": { borderBottom: 0 },
                                /* Cancelled rows halka fade — record bana
                                   hai par active nahi. */
                                opacity: leave.status === "Cancelled" ? 0.72 : 1,
                            }}
                        >
                            <TableCell sx={{ py: 1.5 }}>
                                <TypeLabel type={leave.type} />
                            </TableCell>
                            <TableCell sx={{ py: 1.5, whiteSpace: "nowrap", color: "text.primary", fontSize: 13.5 }}>
                                {formatDate(leave.from)}
                            </TableCell>
                            <TableCell sx={{ py: 1.5, whiteSpace: "nowrap", color: "text.primary", fontSize: 13.5 }}>
                                {formatDate(leave.to)}
                            </TableCell>
                            <TableCell align="center" sx={{ py: 1.5 }}>
                                <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 800, color: INDIGO, fontVariantNumeric: "tabular-nums" }}
                                >
                                    {leave.days}
                                </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.5, maxWidth: 240 }}>
                                <Tooltip title={leave.reason || ""} placement="top" arrow>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "text.secondary",
                                            display: "block",
                                            maxWidth: 220,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {leave.reason || "—"}
                                    </Typography>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ py: 1.5, verticalAlign: "top" }}>
                                <StatusChip status={leave.status} />
                                {leave.status === "Rejected" && <AdminComment comment={leave.adminComment} />}
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                                {leave.status === "Pending" && (
                                    <CancelButton onCancel={() => onCancel(leave)} label="Cancel" />
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

/* ---- Mobile: har leave ek card (md se neeche) -------------------------
   Table chhoti screen par scroll hone ke bajaye poori row ko chipakne
   deti hai, isliye yahan cards render hote hain (CSS se switch hota hai,
   dono ek saath render nahi hote — isliye DOM me duplicate ids nahi). */

function LeaveCardList({ leaves, onCancel }) {
    return (
        <Box className="emp-leave-cards">
            {leaves.map((leave) => (
                <Card
                    key={leave.id}
                    variant="outlined"
                    sx={{
                        borderRadius: 3,
                        borderColor: "#eef0f7",
                        boxShadow: "none",
                        opacity: leave.status === "Cancelled" ? 0.78 : 1,
                    }}
                >
                    <CardContent sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 0.85, "&:last-child": { pb: 1.75 } }}>
                        {/* Row 1 — type (left) + status (right) */}
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                            <Chip
                                label={leave.type}
                                size="small"
                                icon={
                                    <Box
                                        component="span"
                                        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: typeColor(leave.type) }}
                                    />
                                }
                                sx={{
                                    bgcolor: `${typeColor(leave.type)}12`,
                                    color: typeColor(leave.type),
                                    fontWeight: 700,
                                    fontSize: 12.5,
                                    height: 28,
                                }}
                            />
                            <StatusChip status={leave.status} />
                        </Box>

                        {/* Row 2 — range + days */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13.5 }}>
                                {formatDateShort(leave.from)} – {formatDateShort(leave.to)}
                            </Typography>
                            <Box component="span" sx={{ color: "text.disabled" }}>
                                ·
                            </Box>
                            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600, fontSize: 13 }}>
                                {leave.days} {leave.days === 1 ? "day" : "days"}
                            </Typography>
                        </Box>

                        {/* Row 3 — reason (max 2 lines) */}
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                fontSize: 13,
                                lineHeight: 1.45,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {leave.reason || "—"}
                        </Typography>

                        {/* Row 4 — reject hone par admin ka comment */}
                        {leave.status === "Rejected" && leave.adminComment && (
                            <AdminComment comment={leave.adminComment} compact />
                        )}

                        {/* Row 5 — cancel (sirf pending) */}
                        {leave.status === "Pending" && (
                            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                <CancelButton onCancel={() => onCancel(leave)} label="Cancel leave" />
                            </Box>
                        )}
                    </CardContent>
                </Card>
            ))}
        </Box>
    );
}

/* ---- Filter chips -----------------------------------------------------
   Mobile par row scroll hoti hai (`overflowX: auto`), desktop par wrap.
   Isliye koi chip chhoti screen par off-screen nahi reh jaata. */

function FilterChips({ value, onChange, counts }) {
    return (
        <Box
            className="emp-leave-filters"
            role="tablist"
            aria-label="Filter leave requests"
            sx={{
                display: "flex",
                gap: 1,
                flexWrap: { xs: "nowrap", sm: "wrap" },
                overflowX: { xs: "auto", sm: "visible" },
                pb: 0.5,
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
            }}
        >
            {HISTORY_FILTERS.map((filter) => {
                const selected = value === filter;
                const count = counts[filter] ?? 0;
                return (
                    <Chip
                        key={filter}
                        label={`${filter} ${count}`}
                        size="small"
                        onClick={() => onChange(filter)}
                        role="tab"
                        aria-selected={selected}
                        variant={selected ? "filled" : "outlined"}
                        sx={{
                            flexShrink: 0,
                            /* Mobile par 40px touch target (thumb-friendly),
                               desktop par thoda compact. */
                            height: { xs: 40, sm: 34 },
                            px: 0.5,
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                            borderColor: "#e3e6f0",
                            color: "text.secondary",
                            bgcolor: selected ? INDIGO : "transparent",
                            "&:hover": { bgcolor: selected ? INDIGO_DARK : "#f4f5fb" },
                        }}
                    />
                );
            })}
        </Box>
    );
}

function HistorySkeleton() {
    return (
        <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {[0, 1, 2, 3, 4].map((i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Skeleton variant="rounded" width={92} height={26} />
                    <Skeleton width="28%" height={20} />
                    <Skeleton width="18%" height={20} />
                    <Skeleton variant="rounded" width={64} height={26} sx={{ ml: "auto !important" }} />
                </Box>
            ))}
        </Box>
    );
}

function EmptyHistory({ filter, onApply }) {
    return (
        <Box sx={{ py: { xs: 5, md: 6 }, px: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "#f4f5fb",
                    border: "1px dashed #d7dbe8",
                    color: "#b6bcd0",
                    mb: 0.5,
                }}
            >
                <EventBusyOutlined sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
                No leave requests found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 300 }}>
                {filter === "All"
                    ? "You have not applied for any leave yet."
                    : `No ${filter.toLowerCase()} leave requests right now.`}
            </Typography>
            <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={onApply}
                sx={{
                    mt: 1,
                    minHeight: 44,
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 2.5,
                    px: 2.5,
                    bgcolor: INDIGO,
                    "&:hover": { bgcolor: INDIGO_DARK },
                }}
            >
                Apply Leave
            </Button>
        </Box>
    );
}

/* ---- Section -----------------------------------------------------------
   Filter state page ke upar rehta hai (stat cards bhi usi state ko
   badalte hain — isliye component controlled hai, apna `useState` nahi
   rakhta). `onCancel` record bhejta hai (page dialog kholta hai). */

function LeaveHistory({ leaves, loading, filter, onFilterChange, onApply, onCancel }) {
    const counts = useMemo(
        () => ({
            All: leaves.length,
            Approved: leaves.filter((l) => l.status === "Approved").length,
            Pending: leaves.filter((l) => l.status === "Pending").length,
            Rejected: leaves.filter((l) => l.status === "Rejected").length,
            Cancelled: leaves.filter((l) => l.status === "Cancelled").length,
        }),
        [leaves]
    );

    const visible = useMemo(
        () => (filter === "All" ? leaves : leaves.filter((l) => l.status === filter)),
        [leaves, filter]
    );

    return (
        <Box component="section" id={HISTORY_ANCHOR_ID} sx={{ mt: { xs: 3, md: 3.5 }, scrollMarginTop: 80 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", fontSize: { xs: 17, md: 19 }, mb: 0.5 }}>
                Leave History
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
                Track, filter and cancel your leave requests
            </Typography>

            <Card sx={{ ...CARD_SX, overflow: "hidden" }}>
                <CardContent
                    sx={{
                        p: 0,
                        /* Koi fixed height / overflow nahi — pehle table container
                           par max-height tha, jisse header text aur last rows
                           clip ho rahe the. Card apni natural height leta hai. */
                        "&:last-child": { pb: 0 },
                    }}
                >
                    <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2, pb: 1.5 }}>
                        <FilterChips value={filter} onChange={onFilterChange} counts={counts} />
                    </Box>

                    <Divider />

                    {loading ? (
                        <HistorySkeleton />
                    ) : visible.length === 0 ? (
                        <EmptyHistory filter={filter} onApply={onApply} />
                    ) : (
                        <>
                            <LeaveTable leaves={visible} onCancel={onCancel} />
                            <LeaveCardList leaves={visible} onCancel={onCancel} />
                        </>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}

export default LeaveHistory;
