import React from "react";

import "./adminUi.css";

function PageHeader({ title, subtitle, actions = [] }) {
    if (!title) return null;

    return (
        <header className="admin-page-header">
            <div className="admin-page-header-copy">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>

            {actions.length > 0 && (
                <div className="admin-page-actions">
                    {actions.map((action) => {
                        const Icon = action.icon;
                        const variant = action.variant === "primary" ? "is-primary" : "is-ghost";
                        const iconOnly = Boolean(Icon);

                        return (
                            <button
                                key={action.key || action.label}
                                type="button"
                                className={`admin-action-btn ${variant}${iconOnly ? " is-icon" : ""}`}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                aria-label={action.ariaLabel || action.label}
                            >
                                {Icon && <Icon fontSize="small" />}
                                <span className="admin-action-label">{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </header>
    );
}

export default PageHeader;
