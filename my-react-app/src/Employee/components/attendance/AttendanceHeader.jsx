import React from "react";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { monthLabel } from "./attendanceUtils";

function AttendanceHeader({ month, onPrevious, onNext, canGoNext }) {
    return (
        <header className="emp-att-header">
            <div className="emp-att-header-top">
                <h1>Attendance</h1>
                <div className="emp-att-month-picker" role="group" aria-label="Month selector">
                    <button type="button" onClick={onPrevious} aria-label="Previous month">
                        <ChevronLeft />
                    </button>
                    <span aria-live="polite">{monthLabel(month)}</span>
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!canGoNext}
                        aria-label="Next month"
                    >
                        <ChevronRight />
                    </button>
                </div>
            </div>
        </header>
    );
}

export default AttendanceHeader;
