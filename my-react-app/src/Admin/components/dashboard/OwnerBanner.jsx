import React from "react";
import { Button, CircularProgress, Skeleton } from "@mui/material";
import { Add, RefreshRounded } from "@mui/icons-material";

import { formatLongDate, initialsOf } from "./ownerDashboardUi";

function OwnerBanner({
    name,
    role,
    date = new Date(),
    mobile = false,
    loading = false,
    refreshing = false,
    onRefresh,
    onAddEmployee,
}) {
    if (mobile) {
        return (
            <section className="owner-mobile-welcome" aria-label="Welcome">
                {loading ? (
                    <>
                        <Skeleton variant="circular" width={48} height={48} sx={{ bgcolor: "rgba(255,255,255,0.25)" }} />
                        <div className="owner-mobile-welcome-copy">
                            <Skeleton variant="text" width={140} height={18} sx={{ bgcolor: "rgba(255,255,255,0.25)" }} />
                            <Skeleton variant="text" width={190} height={28} sx={{ bgcolor: "rgba(255,255,255,0.25)" }} />
                            <Skeleton variant="text" width={70} height={16} sx={{ bgcolor: "rgba(255,255,255,0.25)" }} />
                        </div>
                    </>
                ) : (
                    <>
                        <span className="owner-mobile-avatar" aria-hidden="true">
                            {initialsOf(name)}
                        </span>
                        <div className="owner-mobile-welcome-copy">
                            <span className="owner-welcome-date">{formatLongDate(date)}</span>
                            <h1>Welcome back, {name}</h1>
                            <span className="owner-welcome-role">{role || "OWNER"}</span>
                        </div>
                    </>
                )}
            </section>
        );
    }

    return (
        <section className="owner-banner" aria-label="Dashboard welcome">
            <div className="owner-banner-copy">
                {loading ? (
                    <>
                        <Skeleton variant="text" width={170} height={18} sx={{ bgcolor: "rgba(255,255,255,0.25)" }} />
                        <Skeleton variant="text" width={280} height={34} sx={{ bgcolor: "rgba(255,255,255,0.25)" }} />
                        <Skeleton variant="text" width={230} height={18} sx={{ bgcolor: "rgba(255,255,255,0.25)" }} />
                    </>
                ) : (
                    <>
                        <span className="owner-welcome-date">{formatLongDate(date)}</span>
                        <h1>Welcome back, {name}</h1>
                        <p>Here is today&apos;s summary of your company.</p>
                    </>
                )}
            </div>

            <div className="owner-banner-actions">
                <Button
                    type="button"
                    className="owner-banner-btn is-ghost"
                    onClick={onRefresh}
                    disabled={refreshing}
                    startIcon={refreshing ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <RefreshRounded />}
                >
                    Refresh
                </Button>
                <Button
                    type="button"
                    className="owner-banner-btn is-white"
                    onClick={onAddEmployee}
                    startIcon={<Add />}
                >
                    Add Employee
                </Button>
            </div>
        </section>
    );
}

export default OwnerBanner;
