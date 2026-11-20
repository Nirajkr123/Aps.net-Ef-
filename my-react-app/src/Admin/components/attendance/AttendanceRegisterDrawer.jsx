import React from "react";
import { Alert, Drawer, IconButton, Skeleton } from "@mui/material";
import {
    CloseRounded,
    EditOutlined,
    EventBusyRounded,
    LockOutlined,
    ScheduleRounded,
} from "@mui/icons-material";

import { formatShortDate, formatTime } from "../../../Employee/components/attendance/attendanceUtils";
import {
    dayTooltip,
    flagLabel,
    formatRegisterHours,
    getCodeMeta,
} from "./attendanceRegisterUi";
import "./AttendanceRegister.css";

const Detail = ({ label, value }) => (
    <div className="att-reg-detail">
        <span>{label}</span>
        <strong>{value ?? "—"}</strong>
    </div>
);

function SegmentCard({ segment, index }) {
    const label = segment.shiftName || `Shift ${segment.shiftId || index + 1}`;

    return (
        <div className="att-reg-segment">
            <div className="att-reg-segment-head">
                <span>
                    <ScheduleRounded fontSize="small" />
                    <strong>{label}</strong>
                </span>
                <span className={`att-reg-segment-status is-${String(segment.status || "").toLowerCase()}`}>
                    {segment.status || "—"}
                </span>
            </div>

            <div className="att-reg-segment-grid">
                <span>
                    <em>Shift</em>
                    {segment.shiftStart
                        ? `${formatTime(segment.shiftStart)} – ${formatTime(segment.shiftEnd)}`
                        : "Not scheduled"}
                    {segment.crossesMidnight ? " · next day" : ""}
                </span>
                <span>
                    <em>Punch</em>
                    {formatTime(segment.checkInTime)} – {formatTime(segment.checkOutTime)}
                </span>
                <span>
                    <em>Hours</em>
                    {formatRegisterHours(segment.workingHours)}
                </span>
                <span>
                    <em>Source</em>
                    {segment.source || "—"}
                </span>
            </div>

            {(segment.checkInLocationName || segment.checkOutLocationName) && (
                <p className="att-reg-segment-note">
                    {[segment.checkInLocationName, segment.checkOutLocationName]
                        .filter(Boolean)
                        .join(" → ")}
                </p>
            )}

            {(segment.isLate || segment.missingCheckout) && (
                <p className="att-reg-segment-warning">
                    {[
                        segment.isLate ? "Late punch" : "",
                        segment.missingCheckout ? "Missing checkout" : "",
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
            )}
        </div>
    );
}

function AttendanceRegisterDrawer({
    open,
    row,
    day,
    cell,
    loading,
    error,
    onClose,
    onRetry,
    onMark,
}) {
    const current = cell || day;
    const meta = getCodeMeta(current?.code);
    const locked = Boolean(cell?.locked || day?.locked);
    const canMark = Boolean(cell?.canMark) && !locked;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: {
                        width: { xs: "100%", sm: 480 },
                        maxWidth: "100%",
                    },
                },
            }}
        >
            <div className="att-reg-drawer">
                <header className="att-reg-drawer-head">
                    <div>
                        <span className="att-reg-eyebrow">
                            {day?.date ? formatShortDate(day.date) : "Day detail"}
                        </span>
                        <h2>{row?.employeeName || cell?.employeeName || "Employee"}</h2>
                        <p>
                            {[row?.employeeCode || cell?.employeeCode, row?.departmentName]
                                .filter(Boolean)
                                .join(" · ") || "Attendance register"}
                        </p>
                    </div>
                    <IconButton aria-label="Close day detail" onClick={onClose} size="small">
                        <CloseRounded fontSize="small" />
                    </IconButton>
                </header>

                <div className="att-reg-drawer-body">
                    {error && (
                        <Alert
                            severity="error"
                            sx={{ borderRadius: 2 }}
                            action={
                                onRetry ? (
                                    <button
                                        type="button"
                                        className="att-reg-link-btn"
                                        onClick={onRetry}
                                    >
                                        Retry
                                    </button>
                                ) : undefined
                            }
                        >
                            {error}
                        </Alert>
                    )}

                    {locked && (
                        <Alert severity="warning" icon={<LockOutlined />} sx={{ borderRadius: 2 }}>
                            This month is locked. Open lock history to reissue a new version
                            before changing attendance.
                        </Alert>
                    )}

                    {loading && !cell ? (
                        <div className="att-reg-drawer-skeleton" aria-label="Loading day detail">
                            <Skeleton variant="rounded" height={76} />
                            <Skeleton variant="rounded" height={112} />
                            <Skeleton variant="rounded" height={120} />
                        </div>
                    ) : (
                        <>
                            <section className={`att-reg-status-card is-${meta.tone}`}>
                                <span className={`att-reg-code is-${meta.tone}`}>
                                    {meta.short}
                                </span>
                                <div>
                                    <strong>{meta.label}</strong>
                                    <p>{dayTooltip(current)}</p>
                                </div>
                            </section>

                            <section className="att-reg-detail-grid">
                                <Detail label="Working hours" value={formatRegisterHours(current?.workingHours)} />
                                <Detail
                                    label="Leave"
                                    value={
                                        current?.leave
                                            ? `${current.leave.type} · ${current.leave.days} day${
                                                  Number(current.leave.days) === 1 ? "" : "s"
                                              }`
                                            : "—"
                                    }
                                />
                                <Detail
                                    label="Leave status"
                                    value={
                                        current?.leave
                                            ? `${current.leave.status}${
                                                  current.leave.halfDay ? " · Half day" : ""
                                              }${current.leave.isPaid ? "" : " · Unpaid"}`
                                            : "—"
                                    }
                                />
                                <Detail
                                    label="Holiday"
                                    value={current?.holiday?.name || (current?.isWeekOff ? "Week off" : "—")}
                                />
                            </section>

                            {current?.flags?.length > 0 && (
                                <section className="att-reg-flags-block">
                                    <h3>Flags</h3>
                                    <div className="att-reg-flags">
                                        {current.flags.map((flag) => (
                                            <span key={flag} className="att-reg-flag">
                                                {flagLabel(flag)}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className="att-reg-segments-block">
                                <h3>Shift segments</h3>
                                {cell?.segments?.length > 0 ? (
                                    cell.segments.map((segment, index) => (
                                        <SegmentCard
                                            key={`${segment.attendanceId || segment.shiftAssignmentId || index}`}
                                            segment={segment}
                                            index={index}
                                        />
                                    ))
                                ) : (
                                    <div className="att-reg-no-segments">
                                        <EventBusyRounded fontSize="small" />
                                        <span>
                                            {cell
                                                ? "No shift segments were found for this day."
                                                : "Open this day to load shift details."}
                                        </span>
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>

                <footer className="att-reg-drawer-actions">
                    <button type="button" className="admin-btn is-ghost-dark" onClick={onClose}>
                        Close
                    </button>
                    <button
                        type="button"
                        className="admin-btn is-primary-solid"
                        onClick={onMark}
                        disabled={!canMark}
                        title={
                            locked
                                ? "This month is locked."
                                : canMark
                                    ? "Mark attendance for this day"
                                    : "This day cannot be marked."
                        }
                    >
                        <EditOutlined fontSize="small" />
                        Mark attendance
                    </button>
                </footer>
            </div>
        </Drawer>
    );
}

export default AttendanceRegisterDrawer;
