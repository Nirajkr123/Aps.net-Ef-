import React from "react";
import { Drawer, IconButton } from "@mui/material";
import { CloseRounded, EventBusyOutlined } from "@mui/icons-material";
import AttendanceLocationLine from "./AttendanceLocationLine";
import AttendanceStatusBadge from "./AttendanceStatusBadge";
import {
    dayKey,
    formatFullDate,
    formatHours,
    formatTime,
    liveHours,
    rowHours,
    rowStatus,
} from "./attendanceUtils";

function DaySheet({ open, day, record, onClose }) {
    const isToday = day ? dayKey(day) === dayKey(new Date()) : false;
    const status = rowStatus(record ? { ...record, isToday } : null);
    const hours = record?.checkInTime && !record?.checkOutTime && isToday
        ? liveHours(record)
        : rowHours(record);

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "emp-att-sheet-paper", elevation: 0 }}
        >
            <div className="emp-att-sheet" role="dialog" aria-label="Day attendance details">
                <div className="emp-att-sheet-handle" aria-hidden="true" />
                <div className="emp-att-sheet-head">
                    <div>
                        <span>Day details</span>
                        <h2>{formatFullDate(day)}</h2>
                    </div>
                    <IconButton onClick={onClose} aria-label="Close day details">
                        <CloseRounded />
                    </IconButton>
                </div>

                {record ? (
                    <>
                        <AttendanceStatusBadge status={status} className="emp-att-sheet-badge" />
                        <div className="emp-att-sheet-grid">
                            <div className="emp-att-sheet-field">
                                <span>Check in</span>
                                <strong>{formatTime(record.checkInTime)}</strong>
                            </div>
                            <div className="emp-att-sheet-field">
                                <span>Check out</span>
                                <strong>{formatTime(record.checkOutTime)}</strong>
                            </div>
                            <div className="emp-att-sheet-field">
                                <span>Total hours</span>
                                <strong>{formatHours(hours)}</strong>
                            </div>
                            <div className="emp-att-sheet-field">
                                <span>Location</span>
                                <AttendanceLocationLine record={record} />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="emp-att-sheet-empty">
                        <EventBusyOutlined aria-hidden="true" />
                        <strong>No record</strong>
                        <span>Is din koi attendance record nahi hai.</span>
                    </div>
                )}
            </div>
        </Drawer>
    );
}

export default DaySheet;
