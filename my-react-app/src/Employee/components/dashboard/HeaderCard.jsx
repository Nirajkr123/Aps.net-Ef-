import React from "react";
import { Avatar, Button, Skeleton } from "@mui/material";
import { CheckCircleOutlined, LocationOnOutlined, Login, Logout } from "@mui/icons-material";

const STATUS_META = {
    OnDuty: { label: "On Duty", tone: "on" },
    CheckedOut: { label: "Completed", tone: "done" },
    OnLeave: { label: "On Leave", tone: "leave" },
    NotCheckedIn: { label: "Not Checked In", tone: "off" },
};

const formatTime = (value) => (
    value
        ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "—"
);

function HeaderCard({
    employee,
    status,
    checkInTime,
    checkOutTime,
    locationName,
    elapsed,
    isLate,
    loading,
    actionLoading,
    actionStage,
    onPunch,
}) {
    const displayName = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") || "Employee";
    const initials = displayName.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = employee?.designationTitle || "Employee";
    const meta = STATUS_META[status] || STATUS_META.NotCheckedIn;
    const checkedIn = !!checkInTime && !checkOutTime;
    const checkedOut = !!checkOutTime;
    const onLeave = status === "OnLeave";

    const buttonLabel = actionLoading
        ? (actionStage === "locating" ? "Location…" : "Saving…")
        : checkedOut
            ? "Completed"
            : checkedIn
                ? "Check Out"
                : "Check In";

    const buttonIcon = checkedOut
        ? <CheckCircleOutlined />
        : checkedIn
            ? <Logout />
            : <Login />;

    return (
        <section className="emp-home-header">
            {loading ? (
                <div className="emp-home-header-skeleton">
                    <Skeleton variant="circular" width={58} height={58} />
                    <div>
                        <Skeleton variant="text" width={150} height={30} />
                        <Skeleton variant="text" width={110} height={18} />
                    </div>
                </div>
            ) : (
                <>
                    <div className="emp-home-header-top">
                        <Avatar
                            src={employee?.profilePhotoUrl || undefined}
                            sx={{
                                width: 58,
                                height: 58,
                                fontWeight: 800,
                                fontSize: 20,
                                bgcolor: "rgba(255,255,255,0.22)",
                                border: "2px solid rgba(255,255,255,0.45)",
                            }}
                        >
                            {initials}
                        </Avatar>

                        <div className="emp-home-identity">
                            <span className="emp-home-role">{roleLabel}</span>
                            <h1>{displayName}</h1>
                            <span className="emp-home-sub">
                                {[employee?.employeeCode, employee?.departmentName].filter(Boolean).join(" · ") || "—"}
                            </span>
                        </div>

                        <span className={`emp-home-status is-${meta.tone}`}>{meta.label}</span>
                    </div>

                    <div className="emp-home-timer">
                        <strong>{elapsed}</strong>
                        <span>{checkedOut ? "work time" : checkedIn ? "on duty" : "not started"}</span>
                    </div>

                    <div className="emp-home-header-bottom">
                        <div className="emp-home-meta">
                            <span>
                                <em>Check-in</em>
                                {formatTime(checkInTime)}
                            </span>
                            <span>
                                <LocationOnOutlined sx={{ fontSize: 15 }} />
                                {locationName || "—"}
                            </span>
                            {isLate && <span className="emp-home-late">Late</span>}
                        </div>

                        <Button
                            variant="contained"
                            size="small"
                            startIcon={buttonIcon}
                            onClick={onPunch}
                            disabled={actionLoading || checkedOut || onLeave}
                            className={`emp-home-punch${checkedIn ? " is-out" : ""}`}
                        >
                            {onLeave ? "On Leave" : buttonLabel}
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}

export default HeaderCard;
