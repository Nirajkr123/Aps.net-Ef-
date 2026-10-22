import React from "react";
import {
    Avatar,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { CheckCircleRounded } from "@mui/icons-material";

import { formatRange, formatRangeShort, typeColor } from "../../../Employee/components/leaves/leaveShared";

/* Approve ka confirmation.

   Kyu dialog: approve karte hi employee ka balance `used` me days jud jaate
   hain — ye undo nahi hota (sirf admin ne hi request cancel ki ho to wapas
   la sakte hain). Isiliye ek clear "haan/nahi" zaroori hai. */
function ApproveDialog({ open, leave, employeeBalance, onClose, onConfirm, approving }) {
    const fullScreen = useMediaQuery((theme) => theme.breakpoints.down("sm"));

    if (!leave) return null;

    const type = leave.type;
    const usedAfter = employeeBalance?.[type]?.used != null
        ? employeeBalance[type].used + leave.days
        : null;
    const totalAfter = employeeBalance?.[type]?.total != null
        ? employeeBalance[type].total
        : null;
    const leftAfter = usedAfter != null && totalAfter != null ? Math.max(0, totalAfter - usedAfter) : null;

    const initials = (leave.employeeName || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("");

    return (
        <Dialog
            open={open}
            onClose={approving ? undefined : onClose}
            fullScreen={fullScreen}
            fullWidth
            maxWidth="xs"
            PaperProps={{ sx: { borderRadius: 4, m: { xs: 0, sm: 2 } } }}
        >
            <DialogTitle
                sx={{
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: { xs: 2, sm: 3 },
                    pt: { xs: 2, sm: 2.5 },
                    pb: 1,
                }}
            >
                <Box
                    sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "#ecfdf5",
                        color: "#059669",
                        flexShrink: 0,
                    }}
                >
                    <CheckCircleRounded sx={{ fontSize: 19 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, minWidth: 0 }}>
                    Approve leave request?
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                    <Avatar
                        sx={{
                            width: 42,
                            height: 42,
                            bgcolor: typeColor(type),
                            fontSize: 14,
                            fontWeight: 800,
                        }}
                    >
                        {initials}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary" }} noWrap>
                            {leave.employeeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {type} leave · {formatRangeShort(leave.from, leave.to)}
                        </Typography>
                    </Box>
                </Box>

                <Box
                    sx={{
                        px: 1.6,
                        py: 1.3,
                        borderRadius: 2.5,
                        bgcolor: "#f7f8fc",
                        border: "1px solid #eef0f7",
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.4,
                    }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13.5 }}>
                        {formatRange(leave.from, leave.to)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.45 }}>
                        {leave.days} {leave.days === 1 ? "day" : "days"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.45 }}>
                        {leave.reason}
                    </Typography>
                </Box>

                {/* Balance ka farak — admin ko approve se pehle pata chal
                    jaye ki employee ke paas kitna balance bachega. */}
                {leftAfter != null && (
                    <Box
                        sx={{
                            mt: 1.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1.5,
                            px: 1.6,
                            py: 1.1,
                            borderRadius: 2.5,
                            bgcolor: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                        }}
                    >
                        <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 700, fontSize: 11.5 }}>
                            {type} balance after approval
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ color: "#047857", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
                        >
                            {leftAfter}/{totalAfter} left
                        </Typography>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, pt: 1.5, gap: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={approving}
                    sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                        minHeight: 44,
                        flex: { xs: 1, sm: "none" },
                    }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="success"
                    onClick={onConfirm}
                    disabled={approving}
                    sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        minHeight: 44,
                        flex: { xs: 1, sm: "none" },
                        px: 3,
                        borderRadius: 2.5,
                        boxShadow: "0 8px 20px -8px rgba(5,150,105,0.6)",
                    }}
                >
                    {approving ? "Approving…" : "Approve"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default ApproveDialog;
