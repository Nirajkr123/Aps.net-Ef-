import React from "react";
import { Skeleton } from "@mui/material";

import "./adminUi.css";

export function StatCard({
    label,
    value,
    sublabel,
    loading = false,
    onClick,
    active = false,
    ariaLabel,
}) {
    const clickable = typeof onClick === "function";

    const handleKeyDown = (event) => {
        if (!clickable) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick(event);
        }
    };

    return (
        <div
            className={`admin-stat-card${clickable ? " is-clickable" : ""}${active ? " is-active" : ""}`}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? active : undefined}
            aria-label={ariaLabel || label}
        >
            {loading ? (
                <>
                    <Skeleton variant="text" width="55%" height={18} />
                    <Skeleton variant="text" width="42%" height={38} />
                    <Skeleton variant="text" width="70%" height={14} />
                </>
            ) : (
                <>
                    <span className="admin-stat-label">{label}</span>
                    <strong className="admin-stat-value">{value ?? "—"}</strong>
                    {sublabel && <span className="admin-stat-sub">{sublabel}</span>}
                </>
            )}
        </div>
    );
}

export function StatGrid({ children, count }) {
    const total = count ?? React.Children.count(children);

    return (
        <div className="admin-stat-grid" data-count={total}>
            {children}
        </div>
    );
}

export default StatCard;
