import React, { useMemo } from "react";
import { Skeleton } from "@mui/material";
import {
    dayKey,
    formatShortDate,
    monthLabel,
    rowStatus,
} from "./attendanceUtils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOT_TONES = {
    Present: "present",
    Late: "late",
    Absent: "absent",
};

function MonthCalendar({ month, rows, todayKey, loading, onSelectDay }) {
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

    return (
        <section className="emp-att-calendar-card" aria-label="Monthly attendance calendar">
            <div className="emp-att-card-head">
                <h2>Monthly calendar</h2>
                <span>{monthLabel(month)}</span>
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
                        const status = rowStatus(record
                            ? { ...record, isToday: key === todayKey }
                            : null);
                        const dot = DOT_TONES[status];
                        const isToday = key === todayKey;
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const isFuture = key > todayKey;

                        return (
                            <button
                                key={key}
                                type="button"
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
            </div>

            {!loading && rows.length === 0 && (
                <p className="emp-att-empty-text">Is mahine abhi koi record nahi.</p>
            )}
        </section>
    );
}

export default MonthCalendar;
