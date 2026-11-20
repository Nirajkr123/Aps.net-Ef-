import React from "react";
import { Skeleton } from "@mui/material";

import { LEAVE_TYPES, LEAVE_TYPE_COLORS } from "../leaves/leaveShared";

function LeaveBreakdownCard({ leave, loading, onOpen }) {
    const balance = leave?.balance || null;
    const total = Number(leave?.total) || 0;
    const remaining = Number(leave?.remaining) || 0;

    return (
        <section className="emp-home-leave">
            <div className="emp-home-card-head">
                <h2>Leave balance</h2>
                <button type="button" className="emp-home-card-link" onClick={onOpen} aria-label="View leave details">
                    Details
                </button>
            </div>

            {loading ? (
                <div className="emp-home-leave-list">
                    {[0, 1, 2, 3].map((item) => (
                        <Skeleton key={item} variant="rounded" height={34} sx={{ borderRadius: 2 }} />
                    ))}
                </div>
            ) : !leave ? (
                <p className="emp-home-muted">No leave data available.</p>
            ) : (
                <>
                    <div className="emp-home-leave-total">
                        <strong>{remaining}</strong>
                        <span>of {total} days left</span>
                    </div>

                    <div className="emp-home-leave-list">
                        {LEAVE_TYPES.map((type) => {
                            const row = balance?.[type] || { total: 0, used: 0 };
                            const rowTotal = Number(row.total) || 0;
                            const rowUsed = Number(row.used) || 0;
                            const rowRemaining = Math.max(0, rowTotal - rowUsed);
                            const progress = rowTotal > 0 ? Math.min(100, (rowUsed / rowTotal) * 100) : 0;
                            const color = LEAVE_TYPE_COLORS[type] || "#6b7280";

                            return (
                                <div className="emp-home-leave-row" key={type}>
                                    <div className="emp-home-leave-row-head">
                                        <span className="emp-home-leave-dot" style={{ backgroundColor: color }} />
                                        <strong>{type}</strong>
                                        <span>{rowRemaining} left</span>
                                    </div>
                                    <div className="emp-home-leave-track">
                                        <span
                                            className="emp-home-leave-fill"
                                            style={{ width: `${progress}%`, backgroundColor: color }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </section>
    );
}

export default LeaveBreakdownCard;
