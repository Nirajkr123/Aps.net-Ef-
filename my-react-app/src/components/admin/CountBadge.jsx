import React from "react";

import "./adminUi.css";

function CountBadge({ value, label, ariaLabel }) {
    return (
        <span className="admin-count-badge" aria-label={ariaLabel}>
            {value}
            {label ? ` ${label}` : ""}
        </span>
    );
}

export default CountBadge;
