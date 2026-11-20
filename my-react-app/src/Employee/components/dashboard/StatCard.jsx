import React from "react";
import { Skeleton } from "@mui/material";

function StatCard({ value, label, tone = "purple", loading = false, onClick, ariaLabel }) {
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
            className={`emp-home-stat is-${tone}${clickable ? " is-clickable" : ""}`}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={ariaLabel || label}
        >
            {loading ? (
                <>
                    <Skeleton variant="text" width="45%" height={38} />
                    <Skeleton variant="text" width="75%" height={18} />
                </>
            ) : (
                <>
                    <strong>{value}</strong>
                    <span>{label}</span>
                </>
            )}
        </div>
    );
}

export default StatCard;
