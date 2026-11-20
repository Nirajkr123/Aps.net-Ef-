import React from "react";
import { Alert, CircularProgress, Skeleton } from "@mui/material";
import { CheckCircleOutlined, Login, Logout } from "@mui/icons-material";
import AttendanceLocationLine from "./AttendanceLocationLine";
import AttendanceStatusBadge from "./AttendanceStatusBadge";
import {
    WINDOW_STATES,
    formatFullDate,
    formatTime,
    resolveTodayWindow,
} from "./attendanceUtils";

function TodayCard({
    state,
    record,
    loading,
    stateError,
    elapsed,
    now,
    punchLoading,
    punchStage,
    punchError,
    onPunch,
}) {
    const attendance = state?.attendance || record;
    const windowInfo = resolveTodayWindow(state, now);
    const hasCheckIn = Boolean(attendance?.checkInTime);
    const hasCheckOut = Boolean(attendance?.checkOutTime);
    const status = hasCheckOut ? "Completed" : hasCheckIn ? "On Duty" : "Not Checked In";
    const isCheckOut = hasCheckIn && !hasCheckOut;
    const canPunch = state ? windowInfo.punchEnabled : !hasCheckOut;
    const attendanceDate = state?.attendanceDate || record?.date || new Date();

    let buttonLabel = hasCheckOut
        ? "Completed"
        : isCheckOut
            ? "Check Out"
            : "Check In";

    if (state && !hasCheckOut && !windowInfo.punchEnabled) {
        if (windowInfo.windowState === WINDOW_STATES.NO_SHIFT) buttonLabel = "No Shift";
        else if (isCheckOut) buttonLabel = "Check-out Closed";
        else if (windowInfo.windowState === WINDOW_STATES.BEFORE_WINDOW) buttonLabel = "Check-in Not Open";
        else buttonLabel = "Check-in Closed";
    }

    const buttonText = punchLoading
        ? punchStage === "locating" ? "Getting location…" : "Saving…"
        : buttonLabel;

    const ButtonIcon = hasCheckOut ? CheckCircleOutlined : isCheckOut ? Logout : Login;

    return (
        <section className="emp-att-today" aria-label="Today's attendance">
            {loading ? (
                <div className="emp-att-today-skeleton">
                    <Skeleton variant="text" width="42%" height={20} />
                    <Skeleton variant="text" width="58%" height={42} />
                    <div className="emp-att-today-boxes">
                        <Skeleton variant="rounded" height={58} />
                        <Skeleton variant="rounded" height={58} />
                    </div>
                    <Skeleton variant="text" width="70%" height={20} />
                    <Skeleton variant="rounded" height={52} />
                </div>
            ) : (
                <>
                    <div className="emp-att-today-head">
                        <div className="emp-att-today-date">
                            <span>{formatFullDate(attendanceDate)}</span>
                            <strong>{elapsed}</strong>
                        </div>
                        <AttendanceStatusBadge status={status} />
                    </div>

                    <div className="emp-att-today-boxes">
                        <div className="emp-att-time-box">
                            <span>Check In</span>
                            <strong>{formatTime(attendance?.checkInTime)}</strong>
                        </div>
                        <div className="emp-att-time-box">
                            <span>Check Out</span>
                            <strong>{formatTime(attendance?.checkOutTime)}</strong>
                        </div>
                    </div>

                    {(windowInfo.shiftLabel || windowInfo.windowSummary) && (
                        <div className="emp-att-shift-row">
                            {windowInfo.shiftLabel && (
                                <span className="emp-att-shift-name">{windowInfo.shiftLabel}</span>
                            )}
                            {state && windowInfo.windowSummary && (
                                <span className={`emp-att-window is-${windowInfo.windowState.toLowerCase()}`}>
                                    {windowInfo.windowSummary}
                                </span>
                            )}
                        </div>
                    )}

                    {state && windowInfo.windowNote && (
                        <p className={`emp-att-window-note${windowInfo.isWarning ? " is-warn" : ""}`}>
                            {windowInfo.windowNote}
                        </p>
                    )}

                    <AttendanceLocationLine record={attendance} className="emp-att-today-location" />

                    {stateError && (
                        <Alert severity="warning" className="emp-att-inline-error">
                            {stateError}
                        </Alert>
                    )}

                    {punchError && (
                        <Alert severity="error" className="emp-att-inline-error">
                            {punchError}
                        </Alert>
                    )}

                    <button
                        type="button"
                        className={`emp-att-punch ${isCheckOut ? "is-out" : "is-in"}`}
                        onClick={onPunch}
                        disabled={loading || punchLoading || !canPunch}
                    >
                        {punchLoading
                            ? <CircularProgress size={18} color="inherit" />
                            : <ButtonIcon aria-hidden="true" />}
                        <span>{buttonText}</span>
                    </button>
                </>
            )}
        </section>
    );
}

export default TodayCard;
