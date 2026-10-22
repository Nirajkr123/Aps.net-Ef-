import React, { useEffect, useState } from "react";
import {
    Avatar,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { CancelRounded } from "@mui/icons-material";

import { formatRange, formatRangeShort, typeColor } from "../../../Employee/components/leaves/leaveShared";

/* Reject dialog — comment REQUIRED hai (server bhi yehi maangta hai).

   Reason: employee ko sirf "rejected" batana kaafi nahi, usse batana
   zaroori hai KIWON, warna wahi request dobara bana deta hai. Isiliye
   field blur aur submit dono par validate hota hai, aur submit button
   khali comment par disabled rehta hai. */
function RejectDialog({ open, leave, onClose, onConfirm, rejecting }) {
    const fullScreen = useMediaQuery((theme) => theme.breakpoints.down("sm"));
    const [comment, setComment] = useState("");
    const [error, setError] = useState("");

    /* Har baar dialog khulte hi clean slate. */
    useEffect(() => {
        if (open) {
            setComment("");
            setError("");
        }
    }, [open]);

    if (!leave) return null;

    const submit = () => {
        const text = comment.trim();
        if (!text) {
            setError("Please tell the employee why this was rejected");
            return;
        }
        onConfirm(text);
    };

    const initials = (leave.employeeName || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("");

    return (
        <Dialog
            open={open}
            onClose={rejecting ? undefined : onClose}
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
                        bgcolor: "#fef2f2",
                        color: "#dc2626",
                        flexShrink: 0,
                    }}
                >
                    <CancelRounded sx={{ fontSize: 19 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, minWidth: 0 }}>
                    Reject leave request
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                    <Avatar
                        sx={{
                            width: 42,
                            height: 42,
                            bgcolor: typeColor(leave.type),
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
                            {leave.type} leave · {formatRangeShort(leave.from, leave.to)}
                        </Typography>
                    </Box>
                </Box>

                <Box
                    sx={{
                        px: 1.6,
                        py: 1.3,
                        mb: 2,
                        borderRadius: 2.5,
                        bgcolor: "#f7f8fc",
                        border: "1px solid #eef0f7",
                    }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13.5 }}>
                        {formatRange(leave.from, leave.to)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.45, display: "block", mt: 0.4 }}>
                        {leave.days} {leave.days === 1 ? "day" : "days"} · {leave.reason}
                    </Typography>
                </Box>

                <TextField
                    label="Reason for rejection"
                    placeholder="e.g. Two client calls land on these dates — please reapply after the meet."
                    fullWidth
                    multiline
                    minRows={3}
                    maxRows={6}
                    value={comment}
                    onChange={(e) => {
                        setComment(e.target.value);
                        if (error) setError("");
                    }}
                    onBlur={() => {
                        if (!comment.trim()) setError("Please tell the employee why this was rejected");
                    }}
                    error={!!error}
                    helperText={error || "Required — the employee sees this on their My Leaves page."}
                    autoFocus
                />
            </DialogContent>

            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, pt: 1.5, gap: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={rejecting}
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
                    color="error"
                    onClick={submit}
                    disabled={rejecting || !comment.trim()}
                    sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        minHeight: 44,
                        flex: { xs: 1, sm: "none" },
                        px: 3,
                        borderRadius: 2.5,
                        boxShadow: "0 8px 20px -8px rgba(220,38,38,0.6)",
                    }}
                >
                    {rejecting ? "Rejecting…" : "Reject leave"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default RejectDialog;
