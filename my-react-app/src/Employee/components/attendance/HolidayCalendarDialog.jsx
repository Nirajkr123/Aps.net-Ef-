import React, { useEffect, useMemo, useState } from "react";
import { Dialog, IconButton, Skeleton } from "@mui/material";
import {
    CelebrationOutlined,
    ChevronLeft,
    ChevronRight,
    Close,
} from "@mui/icons-material";
import {
    dayKey,
    formatFullDate,
    monthLabel,
    parseDate,
} from "./attendanceUtils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const buildMonthCells = (month) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const cells = Array.from({ length: offset }, () => null);

    for (let day = 1; day <= totalDays; day += 1) {
        cells.push(new Date(year, monthIndex, day));
    }

    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
};

function HolidayCalendarDialog({ open, onClose, holidays = [], initialMonth, loading = false }) {
    const [month, setMonth] = useState(() => new Date(initialMonth || Date.now()));

    useEffect(() => {
        if (!open) return;
        const next = new Date(initialMonth || Date.now());
        setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }, [initialMonth, open]);

    const days = useMemo(() => buildMonthCells(month), [month]);
    const today = dayKey(new Date());

    const holidaysByDay = useMemo(() => {
        const map = new Map();
        holidays.forEach((holiday) => {
            const key = dayKey(holiday?.date);
            if (!key) return;
            const rows = map.get(key) || [];
            rows.push(holiday);
            map.set(key, rows);
        });
        return map;
    }, [holidays]);

    const monthHolidays = useMemo(() => holidays
        .filter((holiday) => {
            const date = parseDate(holiday?.date);
            return date
                && date.getFullYear() === month.getFullYear()
                && date.getMonth() === month.getMonth();
        })
        .sort((left, right) => parseDate(left.date) - parseDate(right.date)), [holidays, month]);

    const changeMonth = (amount) => {
        setMonth((current) => new Date(
            current.getFullYear(),
            current.getMonth() + amount,
            1
        ));
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="holiday-calendar-title"
            PaperProps={{ className: "emp-holiday-dialog" }}
        >
            <div className="emp-holiday-dialog-hero">
                <div className="emp-holiday-dialog-title-row">
                    <span className="emp-holiday-dialog-icon" aria-hidden="true">
                        <CelebrationOutlined />
                    </span>
                    <div>
                        <span>Company calendar</span>
                        <h2 id="holiday-calendar-title">Holiday Calendar</h2>
                    </div>
                </div>
                <IconButton
                    onClick={onClose}
                    aria-label="Close holiday calendar"
                    className="emp-holiday-dialog-close"
                >
                    <Close />
                </IconButton>
            </div>

            <div className="emp-holiday-dialog-body">
                <div className="emp-holiday-month-nav">
                    <IconButton onClick={() => changeMonth(-1)} aria-label="Previous month">
                        <ChevronLeft />
                    </IconButton>
                    <div aria-live="polite">
                        <strong>{monthLabel(month)}</strong>
                        <span>{monthHolidays.length} {monthHolidays.length === 1 ? "holiday" : "holidays"}</span>
                    </div>
                    <IconButton onClick={() => changeMonth(1)} aria-label="Next month">
                        <ChevronRight />
                    </IconButton>
                </div>

                <div className="emp-holiday-weekdays" aria-hidden="true">
                    {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
                </div>

                {loading ? (
                    <div className="emp-holiday-calendar-grid" aria-label="Loading holidays">
                        {Array.from({ length: 35 }, (_, index) => (
                            <Skeleton key={index} variant="rounded" height={58} />
                        ))}
                    </div>
                ) : (
                    <div className="emp-holiday-calendar-grid">
                        {days.map((date, index) => {
                            if (!date) return <span key={`blank-${index}`} aria-hidden="true" />;

                            const key = dayKey(date);
                            const dayHolidays = holidaysByDay.get(key) || [];
                            const isHoliday = dayHolidays.length > 0;
                            const holidayNames = dayHolidays.map((holiday) => holiday.name || "Holiday");

                            return (
                                <div
                                    key={key}
                                    className={[
                                        "emp-holiday-day",
                                        date.getDay() === 0 || date.getDay() === 6 ? "is-weekend" : "",
                                        key === today ? "is-today" : "",
                                        isHoliday ? "is-holiday" : "",
                                    ].filter(Boolean).join(" ")}
                                    title={isHoliday ? holidayNames.join(", ") : undefined}
                                    aria-label={`${formatFullDate(date)}${isHoliday ? `, ${holidayNames.join(", ")}` : ""}`}
                                >
                                    <span>{date.getDate()}</span>
                                    {isHoliday && <i aria-hidden="true" />}
                                </div>
                            );
                        })}
                    </div>
                )}

                <section className="emp-holiday-month-list" aria-label={`Holidays in ${monthLabel(month)}`}>
                    <div className="emp-holiday-list-heading">
                        <h3>This month</h3>
                        <span><i aria-hidden="true" /> Holiday</span>
                    </div>

                    {!loading && monthHolidays.length > 0 ? (
                        <div className="emp-holiday-list-rows">
                            {monthHolidays.map((holiday) => {
                                const date = parseDate(holiday.date);
                                return (
                                    <div className="emp-holiday-list-row" key={holiday.id || `${holiday.name}-${holiday.date}`}>
                                        <div className="emp-holiday-date-tile" aria-hidden="true">
                                            <strong>{date?.getDate()}</strong>
                                            <span>{date?.toLocaleDateString("en-IN", { month: "short" })}</span>
                                        </div>
                                        <div>
                                            <strong>{holiday.name || "Holiday"}</strong>
                                            <span>{formatFullDate(holiday.date)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : !loading ? (
                        <div className="emp-holiday-empty">
                            <CelebrationOutlined aria-hidden="true" />
                            <strong>No holidays in this month</strong>
                            <span>Use the month controls to view the upcoming holiday schedule.</span>
                        </div>
                    ) : null}
                </section>
            </div>
        </Dialog>
    );
}

export default HolidayCalendarDialog;
