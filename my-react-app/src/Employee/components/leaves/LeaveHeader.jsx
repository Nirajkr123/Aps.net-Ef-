import React from "react";
import { Button } from "@mui/material";
import { AddRounded, EventOutlined } from "@mui/icons-material";

function LeaveHeader({ onApply, applyDisabled = false, showAction = true }) {
    return (
        <header className="emp-leave-header">
            <div className="emp-leave-header-brand">
                <span className="emp-leave-header-icon" aria-hidden="true">
                    <EventOutlined />
                </span>
                <h1>My Leaves</h1>
            </div>

            {showAction && (
                <Button
                    variant="contained"
                    startIcon={<AddRounded />}
                    className="emp-leave-header-apply"
                    onClick={onApply}
                    disabled={applyDisabled}
                >
                    Apply Leave
                </Button>
            )}
        </header>
    );
}

export default LeaveHeader;
