import React from "react";
import { InboxRounded } from "@mui/icons-material";

import "./adminUi.css";

function EmptyState({ icon, title, subtitle, action }) {
    return (
        <div className="admin-empty">
            <div className="admin-empty-icon">{icon || <InboxRounded />}</div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
            {action && <div className="admin-empty-action">{action}</div>}
        </div>
    );
}

export default EmptyState;
