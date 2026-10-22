import React from "react";
import { Box, Typography } from "@mui/material";

function EmptyState({ icon, title, subtitle }) {
    return (
        <Box sx={{ py: 3.5, px: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
            <Box sx={{
                width: 56, height: 56, borderRadius: "50%",
                bgcolor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center",
                mb: 1, border: "1px dashed #d1d5db",
            }}>
                {icon}
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#374151", fontSize: 14 }}>{title}</Typography>
            <Typography variant="body2" sx={{ color: "#9ca3af", maxWidth: 240, fontSize: 13 }}>{subtitle}</Typography>
        </Box>
    );
}

export default EmptyState;