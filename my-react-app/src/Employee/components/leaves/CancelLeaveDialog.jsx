import React from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { CancelOutlined, EventBusyOutlined } from "@mui/icons-material";

import { formatRange, typeColor } from "./leaveShared";

/* Pending request cancel karne se pehle ka confirmation.

   Dialog kyun: cancel karne ke baad wapas apply nahi kar sakte (record
   `Cancelled` ho jata hai, list se hat jata nahi), isiliye user se ek
   clear "haan/nahi" puchhna zaroori hai. */
function CancelLeaveDialog({ open, leave, onClose, onConfirm, cancelling }) {
    const fullScreen = useMediaQuery((theme) => theme.breakpoints.down("sm"));

    if (!leave) return null;

    return (
        <Dialog
            open={open}
            onClose={cancelling ? undefined : onClose}
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
                    <CancelOutlined sx={{ fontSize: 19 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, minWidth: 0 }}>
                    Cancel leave request?
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                    This will mark your{" "}
                    <Box component="span" sx={{ fontWeight: 800, color: typeColor(leave.type) }}>
                        {leave.type}
                    </Box>{" "}
                    request for{" "}
                    <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>
                        {formatRange(leave.from, leave.to)}
                    </Box>{" "}
                    as <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>Cancelled</Box>. It stays
                    in your history, and your manager will see the change.
                </Typography>

                <Box
                    sx={{
                        mt: 2,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 0.9,
                        px: 1.4,
                        py: 1.15,
                        borderRadius: 2.5,
                        bgcolor: "#f7f8fc",
                        border: "1px solid #eef0f7",
                    }}
                >
                    <EventBusyOutlined sx={{ fontSize: 16, color: "text.disabled", mt: "1px", flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.45 }}>
                        {leave.days} {leave.days === 1 ? "day" : "days"} · {leave.reason}
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, pt: 1.5, gap: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={cancelling}
                    sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                        minHeight: 44,
                        flex: { xs: 1, sm: "none" },
                    }}
                >
                    Keep request
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={onConfirm}
                    disabled={cancelling}
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
                    {cancelling ? "Cancelling…" : "Yes, cancel"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default CancelLeaveDialog;
