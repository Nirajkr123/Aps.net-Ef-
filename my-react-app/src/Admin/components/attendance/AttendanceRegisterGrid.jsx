import React from "react";
import { Skeleton } from "@mui/material";
import { EventBusyRounded } from "@mui/icons-material";

import EmptyState from "../../../components/admin/EmptyState";
import useIsMobile from "../../../hooks/useIsMobile";
import {
    dayTooltip,
    formatDays,
    formatRegisterHours,
    getCodeMeta,
    initialsOf,
} from "./attendanceRegisterUi";

const pad = (value) => String(value).padStart(2, "0");

const TOTAL_COLUMNS = [
    { key: "present", label: "P", title: "Present" },
    { key: "late", label: "LT", title: "Late" },
    { key: "halfDay", label: "HD", title: "Half day" },
    { key: "absent", label: "A", title: "Absent" },
    { key: "paidLeave", label: "L", title: "Paid leave" },
    { key: "unpaidLeave", label: "UL", title: "Unpaid leave" },
    { key: "holiday", label: "H", title: "Holiday" },
    { key: "weekOff", label: "WO", title: "Week off" },
    { key: "lopDays", label: "LOP", title: "Loss of pay" },
    { key: "payableDays", label: "PAY", title: "Payable days" },
];

const buildDayHeaders = (data) => {
    if (!data?.year || !data?.monthNumber || !data?.daysInMonth) return [];
    return Array.from({ length: data.daysInMonth }, (_, index) => {
        const dayNumber = index + 1;
        const date = `${data.year}-${pad(data.monthNumber)}-${pad(dayNumber)}`;
        const parsed = new Date(`${date}T00:00:00`);
        const weekday = parsed.toLocaleDateString("en-IN", { weekday: "short" });
        const isWeekend = parsed.getDay() === 0 || parsed.getDay() === 6;
        return { date, dayNumber, weekday, isWeekend };
    });
};

function EmployeeCell({ row }) {
    return (
        <span className="att-reg-person">
            <span className="att-reg-avatar" aria-hidden="true">
                {initialsOf(row.employeeName)}
            </span>
            <span className="att-reg-person-copy">
                <span className="att-reg-person-name">
                    {row.employeeName || "Unknown employee"}
                </span>
                <span className="att-reg-person-meta">
                    {[row.employeeCode, row.departmentName, row.locationName]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                </span>
                {row.status === "Inactive" && (
                    <span className="att-reg-inactive">
                        Inactive{row.exitDate ? ` · exited ${row.exitDate.slice(0, 10)}` : ""}
                    </span>
                )}
            </span>
        </span>
    );
}

function DayButton({ row, day, compact = false, onCellClick }) {
    const meta = getCodeMeta(day.code);
    const label = `${row.employeeName || "Employee"}, day ${Number(day.date.slice(-2))}: ${meta.label}`;

    return (
        <button
            type="button"
            className={`att-reg-cell is-${meta.tone}${day.isFuture ? " is-future" : ""}${
                day.locked ? " is-locked" : ""
            }${compact ? " is-compact" : ""}`}
            title={dayTooltip(day)}
            aria-label={label}
            onClick={() => onCellClick?.(row, day)}
        >
            {compact && <span className="att-reg-mobile-day">{Number(day.date.slice(-2))}</span>}
            <span className={`att-reg-code is-${meta.tone}`}>{meta.short}</span>
            {day.multiShift && <span className="att-reg-dot" aria-hidden="true" />}
        </button>
    );
}

function LoadingState({ mobile }) {
    if (mobile) {
        return (
            <div className="att-reg-mobile-list" role="status" aria-label="Loading attendance register">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div className="att-reg-mobile-card" key={`register-mobile-skeleton-${index}`}>
                        <Skeleton variant="text" width="55%" height={24} />
                        <Skeleton variant="text" width="80%" height={16} />
                        <Skeleton variant="rounded" height={54} sx={{ mt: 1 }} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="att-reg-loading" role="status" aria-label="Loading attendance register">
            {Array.from({ length: 7 }).map((_, rowIndex) => (
                <div className="att-reg-loading-row" key={`register-skeleton-${rowIndex}`}>
                    <Skeleton variant="text" width="180px" height={24} />
                    {Array.from({ length: 12 }).map((__, cellIndex) => (
                        <Skeleton
                            key={`register-skeleton-${rowIndex}-${cellIndex}`}
                            variant="rounded"
                            width={26}
                            height={24}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

function AttendanceRegisterGrid({ data, loading, onCellClick }) {
    const isMobile = useIsMobile();

    if (loading && !data) {
        return <LoadingState mobile={isMobile} />;
    }

    if (!data || data.items.length === 0) {
        return (
            <div className="att-reg-card">
                <EmptyState
                    icon={<EventBusyRounded />}
                    title="No employees in this register."
                    subtitle="Try another month or clear the department, location and shift filters."
                />
            </div>
        );
    }

    const dayHeaders = buildDayHeaders(data);
    const grandTotals = data.grandTotals || {};

    if (isMobile) {
        return (
            <div className={`att-reg-mobile-list${loading ? " is-updating" : ""}`}>
                {data.items.map((row) => (
                    <article className="att-reg-mobile-card" key={row.employeeId}>
                        <header>
                            <EmployeeCell row={row} />
                            <span className="att-reg-mobile-lop">
                                LOP <strong>{formatDays(row.totals?.lopDays)}</strong>
                            </span>
                        </header>

                        <div className="att-reg-mobile-metrics">
                            <span>P {formatDays(row.totals?.present)}</span>
                            <span>L {formatDays(row.totals?.paidLeave)}</span>
                            <span>A {formatDays(row.totals?.absent)}</span>
                            <span>Pay {formatDays(row.totals?.payableDays)}</span>
                            <span>{formatRegisterHours(row.totals?.workingHours)}</span>
                        </div>

                        <div className="att-reg-mobile-days">
                            {row.days.map((day) => (
                                <DayButton
                                    key={day.date}
                                    row={row}
                                    day={day}
                                    compact
                                    onCellClick={onCellClick}
                                />
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        );
    }

    return (
        <div className={`att-reg-card att-reg-grid-card${loading ? " is-updating" : ""}`}>
            <div className="att-reg-scroll">
                <table className="att-reg-table" aria-label="Monthly attendance register">
                    <thead>
                        <tr>
                            <th className="att-reg-th-employee" scope="col">
                                Employee
                                <span className="att-reg-th-count">{data.total}</span>
                            </th>
                            {dayHeaders.map((day) => (
                                <th
                                    key={day.date}
                                    scope="col"
                                    className={`att-reg-day-head${day.isWeekend ? " is-weekend" : ""}`}
                                    title={day.date}
                                >
                                    <span>{day.weekday}</span>
                                    <strong>{day.dayNumber}</strong>
                                </th>
                            ))}
                            {TOTAL_COLUMNS.map((column) => (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={`att-reg-total-head att-reg-col-${column.key}`}
                                    title={column.title}
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {data.items.map((row) => (
                            <tr key={row.employeeId}>
                                <td className="att-reg-td-employee">
                                    <EmployeeCell row={row} />
                                </td>
                                {row.days.map((day) => (
                                    <td
                                        key={`${row.employeeId}-${day.date}`}
                                        className={`att-reg-day-cell${
                                            day.isWeekOff ? " is-week-off" : ""
                                        }${day.isAfterExit || day.isBeforeJoining ? " is-outside" : ""}`}
                                    >
                                        <DayButton row={row} day={day} onCellClick={onCellClick} />
                                    </td>
                                ))}
                                {TOTAL_COLUMNS.map((column) => (
                                    <td
                                        key={`${row.employeeId}-${column.key}`}
                                        className={`att-reg-total-cell att-reg-col-${column.key}${
                                            column.key === "lopDays" && Number(row.totals?.lopDays) > 0
                                                ? " is-lop"
                                                : ""
                                        }`}
                                        title={column.title}
                                    >
                                        {formatDays(row.totals?.[column.key])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>

                    <tfoot>
                        <tr>
                            <td className="att-reg-td-employee">
                                <span className="att-reg-foot-label">All employees</span>
                                <span className="att-reg-foot-meta">
                                    {formatRegisterHours(grandTotals.workingHours)} worked
                                </span>
                            </td>
                            {dayHeaders.map((day) => (
                                <td key={`grand-${day.date}`} className="att-reg-foot-day" />
                            ))}
                            {TOTAL_COLUMNS.map((column) => (
                                <td
                                    key={`grand-${column.key}`}
                                    className={`att-reg-total-cell att-reg-col-${column.key}${
                                        column.key === "lopDays" && Number(grandTotals.lopDays) > 0
                                            ? " is-lop"
                                            : ""
                                    }`}
                                    title={column.title}
                                >
                                    {formatDays(grandTotals[column.key])}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

export default AttendanceRegisterGrid;
