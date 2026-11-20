import React from "react";
import { Tooltip } from "@mui/material";

import "./adminUi.css";

function RowActions({ actions = [] }) {
    if (actions.length === 0) return null;

    return (
        <span className="admin-row-actions">
            {actions.map((action) => {
                const Icon = action.icon;

                return (
                    <Tooltip key={action.key || action.label} title={action.label} arrow>
                        <span>
                            <button
                                type="button"
                                className={`admin-icon-btn${action.tone === "danger" ? " is-danger" : ""}`}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                aria-label={action.ariaLabel || action.label}
                            >
                                {Icon && <Icon fontSize="small" />}
                            </button>
                        </span>
                    </Tooltip>
                );
            })}
        </span>
    );
}

export default RowActions;
