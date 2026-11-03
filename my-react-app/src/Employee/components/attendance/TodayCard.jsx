import React from "react";
import { Alert, CircularProgress, Skeleton } from "@mui/material";
import { CheckCircleOutlined, Login, Logout } from "@mui/icons-material";
import AttendanceLocationLine from "./AttendanceLocationLine";
import AttendanceStatusBadge from "./AttendanceStatusBadge";
import { formatFullDate, formatTime } from "./attendanceUtils";

function TodayCard({
    record,
    loading,
    elapsed,
    punchLoading,
    punchStage,
    punchError,
    onPunch,
}) {
    const hasCheckIn = Boolean(record?.checkInTime);
    const hasCheckOut = Boolean(record?.checkOutTime);
    const status = hasCheckOut ? "Completed" : hasCheckIn ? "On Duty" : "Not Checked In";
    const isCheckOut = hasCheckIn && !hasCheckOut;

    const buttonLabel = hasCheckOut
        ? "Completed"
        : isCheckOut
            ? "Check Out"
            : "Check In";

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
                            <span>{formatFullDate(new Date())}</span>
                            <strong>{elapsed}</strong>
                        </div>
                        <AttendanceStatusBadge status={status} />
                    </div>

                    <div className="emp-att-today-boxes">
                        <div className="emp-att-time-box">
                            <span>Check In</span>
                            <strong>{formatTime(record?.checkInTime)}</strong>
                        </div>
                        <div className="emp-att-time-box">
                            <span>Check Out</span>
                            <strong>{formatTime(record?.checkOutTime)}</strong>
                        </div>
                    </div>

                    <AttendanceLocationLine record={record} className="emp-att-today-location" />

                    {punchError && (
                        <Alert severity="error" className="emp-att-inline-error">
                            {punchError}
                        </Alert>
                    )}

                    <button
                        type="button"
                        className={`emp-att-punch ${isCheckOut ? "is-out" : "is-in"}`}
                        onClick={onPunch}
                        disabled={loading || punchLoading || hasCheckOut}
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
