import React, { useCallback, useEffect, useState } from "react";
import { Button, Skeleton } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import attendanceServ from "../../../services/attendanceService";
import AttendanceLocationLine from "./AttendanceLocationLine";
import AttendanceStatusBadge from "./AttendanceStatusBadge";
import {
    dayKey,
    formatTime,
    historyRange,
    normalizeRow,
    rowStatus,
    sortRowsDesc,
    unwrapList,
} from "./attendanceUtils";

function AttendanceHistoryView({ onBack }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadHistory = useCallback(async () => {
        setLoading(true);
        setError("");
        const { from, to } = historyRange();
        try {
            const response = await attendanceServ.getMyHistory(from, to);
            setRows(sortRowsDesc(unwrapList(response).map(normalizeRow)));
        } catch (requestError) {
            setRows([]);
            setError(
                requestError.response?.data?.message
                || "Attendance history load nahi ho paayi. Please retry."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const todayKey = dayKey(new Date());

    return (
        <div className="emp-att-history">
            <header className="emp-att-history-header">
                <button type="button" onClick={onBack} aria-label="Back to attendance">
                    <ArrowBack />
                </button>
                <h1>Attendance History</h1>
                <span aria-hidden="true" />
            </header>

            <div className="emp-att-history-body">
                {error ? (
                    <div className="emp-att-error-card">
                        <p>{error}</p>
                        <Button variant="contained" onClick={loadHistory}>Retry</Button>
                    </div>
                ) : (
                    <section className="emp-att-history-card" aria-label="Attendance history">
                        {loading ? (
                            <div className="emp-att-history-list">
                                {Array.from({ length: 6 }, (_, index) => (
                                    <div className="emp-att-history-skeleton" key={index}>
                                        <Skeleton variant="rounded" width={46} height={46} />
                                        <div>
                                            <Skeleton variant="text" width="65%" height={20} />
                                            <Skeleton variant="text" width="45%" height={16} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : rows.length === 0 ? (
                            <p className="emp-att-empty-text">Abhi koi attendance history nahi.</p>
                        ) : (
                            <div className="emp-att-history-list">
                                {rows.map((row) => {
                                    const date = new Date(row.date);
                                    const status = rowStatus({
                                        ...row,
                                        isToday: dayKey(row.date) === todayKey,
                                    });

                                    return (
                                        <article className="emp-att-history-row" key={row.id || row.date}>
                                            <div className="emp-att-log-date">
                                                <span>{date.getDate()}</span>
                                                <strong>{date.toLocaleDateString("en-IN", { month: "short" })}</strong>
                                                <em>{date.getFullYear()}</em>
                                            </div>
                                            <div className="emp-att-history-main">
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
                )}
            </div>
        </div>
    );
}

export default AttendanceHistoryView;
