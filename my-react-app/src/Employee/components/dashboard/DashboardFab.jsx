import React from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import { EventOutlined, PaymentsOutlined } from "@mui/icons-material";

function DashboardFab({ onApplyLeave, onViewPayslips }) {
    return (
        <SpeedDial
            ariaLabel="Quick actions"
            className="emp-home-fab"
            direction="up"
            icon={<SpeedDialIcon />}
            FabProps={{ size: "medium" }}
        >
            <SpeedDialAction
                icon={<EventOutlined />}
                tooltipTitle="Apply Leave"
                onClick={onApplyLeave}
            />
            <SpeedDialAction
                icon={<PaymentsOutlined />}
                tooltipTitle="View Payslips"
                onClick={onViewPayslips}
            />
        </SpeedDial>
    );
}

export default DashboardFab;
