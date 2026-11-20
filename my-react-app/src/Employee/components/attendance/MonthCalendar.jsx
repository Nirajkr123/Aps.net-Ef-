import React, { useMemo } from "react";
import { Skeleton } from "@mui/material";
import { CelebrationOutlined } from "@mui/icons-material";
import {
    dayKey,
    formatShortDate,
    rowStatus,
} from "./attendanceUtils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOT_TONES = {
    Present: "present",
    Late: "late",
    Absent: "absent",
    Leave: "leave",
    Holiday: "holiday",
};

function MonthCalendar({
    month,
    rows,
    leaves = [],
    holidays = [],
    todayKey,
    loading,
    onSelectDay,
    onOpenHolidayCalendar,
}) {
    const days = useMemo(() => {
        const date = new Date(month);
        const year = date.getFullYear();
        const monthIndex = date.getMonth();
        const firstDay = new Date(year, monthIndex, 1);
        const offset = (firstDay.getDay() + 6) % 7;
        const totalDays = new Date(year, monthIndex + 1, 0).getDate();
        const cells = Array.from({ length: offset }, () => null);

        for (let day = 1; day <= totalDays; day += 1) {
            cells.push(new Date(year, monthIndex, day));
        }

        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [month]);

    const recordsByDay = useMemo(() => {
        const map = new Map();
        rows.forEach((row) => {
            if (row.date) map.set(dayKey(row.date), row);
        });
        return map;
    }, [rows]);

    // Approved leaves: startDate se endDate tak ke saare din
    const leavesByDay = useMemo(() => {
        const map = new Map();
        leaves.forEach((leave) => {
            if (String(leave.status || "").toLowerCase() !== "approved") return;
            const start = new Date(leave.from || leave.startDate);
            const end = new Date(leave.to || leave.endDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                map.set(dayKey(new Date(d)), leave);
            }
        });
        return map;
    }, [leaves]);

    const holidaysByDay = useMemo(() => {
        const map = new Map();
        holidays.forEach((holiday) => {
            const key = dayKey(holiday?.date);
            if (key) map.set(key, holiday);
        });
        return map;
    }, [holidays]);

    return (
        <section className="emp-att-calendar-card" aria-label="Monthly attendance calendar">
            <div className="emp-att-card-head">
                <h2>Monthly calendar</h2>
                <button
                    type="button"
                    className="emp-att-holiday-calendar-button"
                    onClick={onOpenHolidayCalendar}
                >
                    <CelebrationOutlined />
                    Holiday calendar
                </button>
            </div>

            <div className="emp-att-weekdays" aria-hidden="true">
                {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
            </div>

            {loading ? (
                <div className="emp-att-calendar-grid">
                    {Array.from({ length: 35 }, (_, index) => (
                        <Skeleton
                            key={index}
                            variant="rounded"
                            height={44}
                            className="emp-att-calendar-skeleton"
                        />
                    ))}
                </div>
            ) : (
                <div className="emp-att-calendar-grid">
                    {days.map((date, index) => {
                        if (!date) {
                            return <span key={`blank-${index}`} aria-hidden="true" />;
                        }

                        const key = dayKey(date);
                        const record = recordsByDay.get(key);
                        const holiday = holidaysByDay.get(key);
                        const leave = leavesByDay.get(key);

                        let status = rowStatus(record
                            ? { ...record, isToday: key === todayKey }
                            : null);

                        // Priority: Holiday > Leave > Attendance
                        if (holiday) status = "Holiday";
                        else if (leave && !record) status = "Leave";

                        const dot = DOT_TONES[status];
                        const isToday = key === todayKey;
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const isFuture = key > todayKey;
                        const tooltip = holiday
                            ? holiday.name
                            : leave
                                ? `${leave.type || leave.leaveType || "Leave"}${leave.halfDay ? " (Half day)" : ""}`
                                : undefined;

                        return (
                            <button
                                key={key}
                                type="button"
                                title={tooltip}
                                className={[
                                    "emp-att-day",
                                    isToday ? "is-today" : "",
                                    isWeekend ? "is-weekend" : "",
                                    isFuture ? "is-future" : "",
                                ].filter(Boolean).join(" ")}
                                onClick={() => onSelectDay(date)}
                                aria-label={`${formatShortDate(date)}, ${status}`}
                            >
                                <span>{date.getDate()}</span>
                                {dot && <i className={`emp-att-dot is-${dot}`} aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="emp-att-legend">
                <span><i className="emp-att-dot is-present" aria-hidden="true" /> Present</span>
                <span><i className="emp-att-dot is-late" aria-hidden="true" /> Late</span>
                <span><i className="emp-att-dot is-absent" aria-hidden="true" /> Absent</span>
                <span><i className="emp-att-dot is-leave" aria-hidden="true" /> Leave</span>
                <span><i className="emp-att-dot is-holiday" aria-hidden="true" /> Holiday</span>
            </div>

            {!loading && rows.length === 0 && (
                <p className="emp-att-empty-text">No records for this month yet.</p>
            )}
        </section>
    );
}

export default MonthCalendar;
