import React from "react";
import { Card, CardContent, Skeleton } from "@mui/material";

function ProfileStatCard({
    icon,
    value,
    label,
    hint,
    tone = "#4f46e5",
    bg = "#eef2ff",
    hintTone = "",
    loading = false,
    compact = false,
}) {
    return (
        <Card
            elevation={0}
            className={`emp-dash-stat emp-prof-stat${compact ? " is-compact" : ""}`}
            aria-label={hint ? `${label}: ${value}. ${hint}` : `${label}: ${value}`}
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
                        {hint && (
                            <span className={`emp-prof-stat-hint${hintTone ? ` is-${hintTone}` : ""}`}>
                                {hint}
                            </span>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default ProfileStatCard;
