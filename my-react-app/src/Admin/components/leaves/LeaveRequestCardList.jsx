import React from "react";
import {
    Box,
    Button,
    Card,
    Checkbox,
    Chip,
    Typography,
} from "@mui/material";
import { CancelRounded, CheckCircleRounded } from "@mui/icons-material";

import {
    INDIGO,
    formatDateTime,
    formatRange,
    typeColor,
} from "../../../Employee/components/leaves/leaveShared";

import { EmployeeCell, LeaveStatusChip } from "./LeaveRequestTable";

/* ---- Mobile: har request ek card (md se neeche) ------------------------
   Table chhoti screen par scroll hone ke bajaye poora card chipka deta
   hai, aur action buttons card ke NEECHE full-width milte hain — thumb
   reach ke andar rehte hain.

   `LeaveRequestTable` ke saath CSS se switch hota hai, dono ek saath
   render nahi hote (isliye duplicate ids nahi ban'te). */
function LeaveRequestCardList({
    leaves,
    selected,
    onToggleSelect,
    onOpenDetails,
    onApprove,
    onReject,
}) {
    return (
        <Box className="adm-leave-cards">
            {leaves.map((leave) => {
                const pending = leave.status === "Pending";
                const checked = selected.includes(leave.id);

                return (
                    <Card
                        key={leave.id}
                        variant="outlined"
                        onClick={() => onOpenDetails(leave)}
                        sx={{
                            borderRadius: 3,
                            borderColor: checked ? INDIGO : "#eef0f7",
                            boxShadow: checked ? `0 0 0 2px ${INDIGO}22` : "none",
                            cursor: "pointer",
                            opacity: leave.status === "Cancelled" ? 0.78 : 1,
                        }}
                    >
                        {/* ---- Top: checkbox + employee + status ---- */}
                        <Box
                            sx={{
                                p: 1.75,
                                pb: 1.25,
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 1,
                            }}
                        >
                            <Box onClick={(e) => e.stopPropagation()} sx={{ mt: -0.5, ml: -0.5 }}>
                                <Checkbox
                                    size="small"
                                    checked={checked}
                                    disabled={!pending}
                                    onChange={() => onToggleSelect(leave.id)}
                                    inputProps={{ "aria-label": `Select leave request from ${leave.employeeName}` }}
                                />
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <EmployeeCell name={leave.employeeName} />
                            </Box>

                            <LeaveStatusChip status={leave.status} />
                        </Box>

                        {/* ---- Middle: type / range / days / reason / applied ---- */}
                        <Box
                            sx={{
                                px: 1.75,
                                pb: 1.5,
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.85,
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
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
                                        fontSize: 12,
                                        height: 26,
                                    }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13 }}>
                                    {formatRange(leave.from, leave.to)}
                                </Typography>
                                <Box
                                    sx={{
                                        px: 0.85,
                                        py: 0.15,
                                        borderRadius: 1.5,
                                        bgcolor: "#eef0ff",
                                        color: INDIGO,
                                        fontWeight: 800,
                                        fontSize: 11.5,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {leave.days} {leave.days === 1 ? "day" : "days"}
                                </Box>
                            </Box>

                            <Typography
                                variant="body2"
                                sx={{
                                    color: "text.secondary",
                                    fontSize: 13,
                                    lineHeight: 1.45,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                }}
                            >
                                {leave.reason || "—"}
                            </Typography>

                            <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, fontSize: 11.5 }}>
                                Applied {formatDateTime(leave.appliedOn)}
                                {leave.reviewedBy ? ` · reviewed by ${leave.reviewedBy}` : ""}
                            </Typography>

                            {leave.adminComment && (
                                <Box
                                    sx={{
                                        px: 1.2,
                                        py: 0.9,
                                        borderRadius: 2,
                                        bgcolor: "#fef2f2",
                                        border: "1px solid #fecaca",
                                    }}
                                >
                                    <Typography sx={{ fontSize: 11.5, color: "#991b1b", lineHeight: 1.45 }}>
                                        {leave.adminComment}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* ---- Bottom: actions (sirf Pending) ---- */}
                        {pending && (
                            <Box
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                    px: 1.75,
                                    pb: 1.75,
                                    display: "flex",
                                    gap: 1,
                                }}
                            >
                                <Button
                                    variant="outlined"
                                    onClick={() => onReject(leave)}
                                    startIcon={<CancelRounded sx={{ fontSize: "18px !important" }} />}
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: 700,
                                        fontSize: 13,
                                        minHeight: 42,
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
                                    onClick={() => onApprove(leave)}
                                    startIcon={<CheckCircleRounded sx={{ fontSize: "18px !important" }} />}
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: 700,
                                        fontSize: 13,
                                        minHeight: 42,
                                        flex: 1,
                                        borderRadius: 2.5,
                                    }}
                                >
                                    Approve
                                </Button>
                                <Button
                                    variant="text"
                                    onClick={() => onOpenDetails(leave)}
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: 700,
                                        fontSize: 13,
                                        minHeight: 42,
                                        borderRadius: 2.5,
                                        color: "text.secondary",
                                        px: 1.5,
                                        minWidth: 0,
                                    }}
                                >
                                    Details
                                </Button>
                            </Box>
                        )}
                    </Card>
                );
            })}
        </Box>
    );
}

export default LeaveRequestCardList;
