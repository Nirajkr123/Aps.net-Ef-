import React from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import { AccessTimeOutlined, EventOutlined } from "@mui/icons-material";

function DashboardFab({ onApplyLeave, onRegularization }) {
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
                icon={<AccessTimeOutlined />}
                tooltipTitle="Regularization (coming soon)"
                onClick={onRegularization}
                FabProps={{ disabled: true }}
            />
        </SpeedDial>
    );
}

export default DashboardFab;
