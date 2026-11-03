import React, { useMemo } from "react";
import { Skeleton } from "@mui/material";
import { ChevronRight } from "@mui/icons-material";
import AttendanceLocationLine from "./AttendanceLocationLine";
import AttendanceStatusBadge from "./AttendanceStatusBadge";
import {
    dayKey,
    formatTime,
    rowStatus,
} from "./attendanceUtils";

function RecentLogs({ rows, todayKey, loading, onViewAll }) {
    const logs = useMemo(() => (
        [...rows]
            .sort((left, right) => new Date(right.date) - new Date(left.date))
            .slice(0, 3)
    ), [rows]);

    return (
        <section className="emp-att-logs-card" aria-label="Recent attendance logs">
            <div className="emp-att-card-head">
                <h2>Recent logs</h2>
                <button type="button" className="emp-att-view-all" onClick={onViewAll}>
                    View all
                    <ChevronRight aria-hidden="true" />
                </button>
            </div>

            {loading ? (
                <div className="emp-att-log-list">
                    {[0, 1, 2].map((row) => (
                        <div className="emp-att-log-skeleton" key={row}>
                            <Skeleton variant="rounded" width={46} height={46} />
                            <div>
                                <Skeleton variant="text" width="70%" height={20} />
                                <Skeleton variant="text" width="52%" height={16} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : logs.length === 0 ? (
                <p className="emp-att-empty-text">Is mahine abhi koi record nahi.</p>
            ) : (
                <div className="emp-att-log-list">
                    {logs.map((row) => {
                        const date = new Date(row.date);
                        const status = rowStatus({
                            ...row,
                            isToday: dayKey(row.date) === todayKey,
                        });

                        return (
                            <article className="emp-att-log" key={row.id || row.date}>
                                <div className="emp-att-log-date">
                                    <span>{date.getDate()}</span>
                                    <strong>{date.toLocaleDateString("en-IN", { month: "short" })}</strong>
                                </div>
                                <div className="emp-att-log-main">
                                    <strong>
                                        In {formatTime(row.checkInTime)}
                                        <span aria-hidden="true"> · </span>
                                        Out {formatTime(row.checkOutTime)}
                                    </strong>
                                    <AttendanceLocationLine record={row} />
                                </div>
                                <AttendanceStatusBadge status={status} />
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default RecentLogs;
