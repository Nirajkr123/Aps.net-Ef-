import React from "react";
import { Avatar, Button, Skeleton } from "@mui/material";
import { CheckCircleOutlined, LocationOnOutlined, Login, Logout } from "@mui/icons-material";
import { WINDOW_STATES, resolveTodayWindow } from "../attendance/attendanceUtils";

const STATUS_META = {
    OnDuty: { label: "Checked in", tone: "on" },
    CheckedOut: { label: "Checked out", tone: "done" },
    OnLeave: { label: "On leave", tone: "leave" },
    NotCheckedIn: { label: "Not checked in", tone: "off" },
};

const formatTime = (value) => (
    value
        ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "—"
);

const formatEmployeeShift = (employee) => {
    const name = employee?.shiftName?.trim();
    if (!name) return "";
    const timing = employee?.shiftTiming?.trim();
    return timing ? `${name} · ${timing}` : name;
};

function HeaderCard({
    employee,
    status,
    checkInTime,
    checkOutTime,
    locationName,
    elapsed,
    isLate,
    todayState,
    todayStateError,
    now,
    greeting = "Hello",
    loading,
    actionLoading,
    actionStage,
    onPunch,
}) {
    const displayName = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") || "Employee";
    const initials = displayName.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
    const windowInfo = resolveTodayWindow(todayState, now);
    const shiftLabel = windowInfo.shiftLabel || formatEmployeeShift(employee);
    const hasShiftToday = Boolean(todayState?.shift);
    const showShiftSummary = windowInfo.windowState !== WINDOW_STATES.NO_SHIFT;
    const stateAttendance = todayState?.attendance || null;
    const effectiveCheckInTime = stateAttendance ? stateAttendance.checkInTime : checkInTime;
    const effectiveCheckOutTime = stateAttendance ? stateAttendance.checkOutTime : checkOutTime;
    const effectiveIsLate = stateAttendance ? stateAttendance.isLate : isLate;
    const effectiveLocation = stateAttendance?.checkInLocationName
        || stateAttendance?.checkOutLocationName
        || stateAttendance?.location
        || locationName;
    const checkedIn = Boolean(effectiveCheckInTime) && !effectiveCheckOutTime;
    const checkedOut = Boolean(effectiveCheckOutTime);
    const onLeave = status === "OnLeave";
    const effectiveStatus = onLeave
        ? "OnLeave"
        : checkedOut
            ? "CheckedOut"
            : checkedIn
                ? "OnDuty"
                : todayState
                    ? "NotCheckedIn"
                    : status;
    const meta = STATUS_META[effectiveStatus] || STATUS_META.NotCheckedIn;
    const canPunch = todayState ? windowInfo.punchEnabled : !checkedOut && !onLeave;
    const showWindowNote = Boolean(todayStateError)
        || Boolean(todayState && hasShiftToday && !checkedOut && (!windowInfo.punchEnabled || windowInfo.isWarning));
    const subline = [
        employee?.employeeCode,
        employee?.designationTitle,
        employee?.departmentName,
    ].filter(Boolean).join(" · ");

    let buttonLabel = checkedOut
        ? "Completed"
        : checkedIn
            ? "Check Out"
            : "Check In";

    if (!checkedOut && todayState && !canPunch) {
        if (windowInfo.windowState === WINDOW_STATES.NO_SHIFT) buttonLabel = "No Shift";
        else if (checkedIn) buttonLabel = "Check-out Closed";
        else if (windowInfo.windowState === WINDOW_STATES.BEFORE_WINDOW) buttonLabel = "Check-in Not Open";
        else buttonLabel = "Check-in Closed";
    }

    if (actionLoading) {
        buttonLabel = actionStage === "locating" ? "Locating…" : "Saving…";
    }

    const buttonIcon = checkedOut
        ? <CheckCircleOutlined />
        : checkedIn
            ? <Logout />
            : <Login />;

    return (
        <section className="emp-home-header">
            {loading ? (
                <div className="emp-home-header-skeleton">
                    <Skeleton variant="circular" width={52} height={52} />
                    <div>
                        <Skeleton variant="text" width={130} height={18} />
                        <Skeleton variant="text" width={190} height={28} />
                        <Skeleton variant="text" width={150} height={16} />
                    </div>
                </div>
            ) : (
                <div className="emp-home-header-main">
                    <div className="emp-home-profile">
                        <Avatar
                            src={employee?.profilePhotoUrl || undefined}
                            className="emp-home-avatar"
                            sx={{
                                width: 52,
                                height: 52,
                                fontWeight: 800,
                                fontSize: 18,
                                bgcolor: "rgba(255,255,255,0.2)",
                                border: "2px solid rgba(255,255,255,0.42)",
                            }}
                        >
                            {initials}
                        </Avatar>

                        <div className="emp-home-identity">
                            <span className="emp-home-greeting">{greeting},</span>
                            <h1>{displayName}</h1>
                            <span className="emp-home-sub">{subline || "Employee"}</span>
                        </div>
                    </div>

                    <div className="emp-home-header-side">
                        <div className="emp-home-status-row">
                            <span className={`emp-home-status is-${meta.tone}`}>{meta.label}</span>
                            <span className="emp-home-timer">
                                <strong>{effectiveCheckInTime ? elapsed : "—"}</strong>
                                <span>{checkedOut ? "work time" : checkedIn ? "on duty" : "not started"}</span>
                            </span>
                        </div>

                        <div className="emp-home-meta">
                            <span><em>In</em>{formatTime(effectiveCheckInTime)}</span>
                            <span><em>Out</em>{formatTime(effectiveCheckOutTime)}</span>
                            <span className="emp-home-location">
                                <LocationOnOutlined sx={{ fontSize: 15 }} />
                                <span>{effectiveLocation || "Location unavailable"}</span>
                            </span>
                            {effectiveIsLate && <span className="emp-home-late">Late</span>}
                        </div>

                        {(shiftLabel || (showShiftSummary && windowInfo.windowSummary)) && (
                            <div className="emp-home-shift">
                                {shiftLabel && <span>{shiftLabel}</span>}
                                {showShiftSummary && windowInfo.windowSummary && (
                                    <strong>{windowInfo.windowSummary}</strong>
                                )}
                            </div>
                        )}

                        {showWindowNote && (
                            <span className={`emp-home-window-note${windowInfo.isWarning ? " is-warn" : ""}`}>
                                {todayStateError || windowInfo.windowNote}
                            </span>
                        )}

                        <div className="emp-home-action-row">
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={buttonIcon}
                                onClick={onPunch}
                                disabled={actionLoading || checkedOut || onLeave || !canPunch}
                                className={`emp-home-punch${checkedIn ? " is-out" : ""}`}
                                title={!canPunch && hasShiftToday ? windowInfo.windowNote : undefined}
                            >
                                {onLeave ? "On Leave" : buttonLabel}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default HeaderCard;
