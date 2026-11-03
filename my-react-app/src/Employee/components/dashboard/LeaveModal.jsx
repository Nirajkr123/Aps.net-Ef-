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
                    {!loading && <Typography variant="caption" sx={{ color: "#9ca3af" }}>{leave?.remaining ?? 0} days left</Typography>}
                </Box>
                <IconButton onClick={onClose} size="small" aria-label="Close leave balance">
                    <CloseRounded fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 0.5 }}>
                {loading ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                        {[0, 1, 2, 3].map((item) => (
                            <Skeleton key={item} variant="rounded" height={50} sx={{ borderRadius: 2 }} />
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {LEAVE_TYPES.map((type) => {
                            const row = balance?.[type] || { total: 0, used: 0 };
                            const remaining = Math.max(0, row.total - row.used);
                            const color = LEAVE_TYPE_COLORS[type] || "#6b7280";

                            return (
                                <Box
                                    key={type}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.25,
                                        px: 1.5,
                                        py: 1.1,
                                        borderRadius: 2,
                                        border: "1px solid #eceef5",
                                        bgcolor: "#fbfcff",
                                    }}
                                >
                                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#171b2e" }}>
                                            {type}
                                        </Typography>
                                        <Typography sx={{ fontSize: 11.5, color: "#6b7280" }}>
                                            {remaining} left
                                        </Typography>
                                    </Box>
                                    <Typography
                                        sx={{
                                            fontWeight: 800,
                                            fontSize: 15,
                                            color,
                                            fontVariantNumeric: "tabular-nums",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {row.used}/{row.total}
                                    </Typography>
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
