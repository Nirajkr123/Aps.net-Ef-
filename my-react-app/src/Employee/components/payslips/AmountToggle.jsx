import React from "react";
import { IconButton } from "@mui/material";
import { VisibilityOffOutlined, VisibilityOutlined } from "@mui/icons-material";

function AmountToggle({ hidden, onToggle }) {
    return (
        <IconButton
            type="button"
            className="payslip-amount-toggle"
            aria-label={hidden ? "Show payslip amounts" : "Hide payslip amounts"}
            aria-pressed={hidden}
            onClick={onToggle}
        >
            {hidden ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
        </IconButton>
    );
}

export default AmountToggle;
