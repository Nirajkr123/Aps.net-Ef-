import React from "react";
import { Card, CardContent, Skeleton } from "@mui/material";

function DashboardStatCard({
    icon,
    label,
    value,
    tone = "#4f46e5",
    bg = "#eef2ff",
    loading = false,
    onClick,
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
        <Card
            elevation={0}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={ariaLabel || label}
            className={`emp-dash-stat${clickable ? " is-clickable" : ""}`}
        >
            <CardContent>
                {loading ? (
                    <>
                        <Skeleton variant="rounded" width={30} height={30} sx={{ borderRadius: 2, mb: 0.75 }} />
                        <Skeleton variant="text" width="55%" height={30} />
                        <Skeleton variant="text" width="75%" height={16} />
                    </>
                ) : (
                    <>
                        <span className="emp-dash-stat-icon" style={{ backgroundColor: bg, color: tone }}>
                            {icon}
                        </span>
                        <strong className="emp-dash-stat-value">{value}</strong>
                        <span className="emp-dash-stat-label">{label}</span>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default DashboardStatCard;
