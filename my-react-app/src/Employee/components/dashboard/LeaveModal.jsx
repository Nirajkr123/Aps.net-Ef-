import React from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Skeleton,
    Typography,
} from "@mui/material";
import { CloseRounded, EventOutlined } from "@mui/icons-material";

import { LEAVE_TYPES, LEAVE_TYPE_COLORS } from "../leaves/leaveShared";

function LeaveModal({ open, onClose, leave, loading, onApply }) {
    const balance = leave?.balance || null;
    const total = Number(leave?.total) || 0;
    const remaining = Number(leave?.remaining) || 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{ sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } }}
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800, pb: 1 }}>
                <Box
                    sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "#ecfdf5",
                        color: "#059669",
                    }}
                >
                    <EventOutlined sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                        Leave Balance
                    </Typography>
                    {!loading && (
                        <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                            {remaining} of {total} days left
                        </Typography>
                    )}
                </Box>
                <IconButton onClick={onClose} size="small" aria-label="Close leave balance">
                    <CloseRounded fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 0.5 }}>
                {loading ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                        {[0, 1, 2, 3].map((item) => (
                            <Skeleton key={item} variant="rounded" height={62} sx={{ borderRadius: 2 }} />
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                        {LEAVE_TYPES.map((type) => {
                            const row = balance?.[type] || { total: 0, used: 0 };
                            const rowTotal = Number(row.total) || 0;
                            const rowUsed = Number(row.used) || 0;
                            const rowRemaining = Math.max(0, rowTotal - rowUsed);
                            const progress = rowTotal > 0 ? Math.min(100, (rowUsed / rowTotal) * 100) : 0;
                            const color = LEAVE_TYPE_COLORS[type] || "#6b7280";

                            return (
                                <Box
                                    key={type}
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 0.8,
                                        px: 1.5,
                                        py: 1.1,
                                        borderRadius: 2,
                                        border: "1px solid #eceef5",
                                        bgcolor: "#fbfcff",
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                                        <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#171b2e" }}>
                                                {type}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11.5, color: "#6b7280" }}>
                                                {rowRemaining} left
                                            </Typography>
                                        </Box>
                                        <Typography
                                            sx={{
                                                fontWeight: 800,
                                                fontSize: 14,
                                                color,
                                                fontVariantNumeric: "tabular-nums",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {rowUsed}/{rowTotal}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ height: 6, borderRadius: 999, bgcolor: "#eef0f7", overflow: "hidden" }}>
                                        <Box
                                            sx={{
                                                width: `${progress}%`,
                                                height: "100%",
                                                borderRadius: 999,
                                                bgcolor: color,
                                            }}
                                        />
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
                <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: "#6b7280" }}>
                    Close
                </Button>
                <Button
                    variant="contained"
                    onClick={onApply}
                    sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 2,
                        bgcolor: "#4f46e5",
                        "&:hover": { bgcolor: "#4338ca" },
                    }}
                >
                    Apply Leave
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default LeaveModal;
