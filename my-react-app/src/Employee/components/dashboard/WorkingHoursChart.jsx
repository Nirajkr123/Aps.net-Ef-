import React from "react";
import { Skeleton } from "@mui/material";
import { AccessTimeOutlined } from "@mui/icons-material";

function WorkingHoursChart({ days = [], total = 0, loading = false }) {
    const maxHours = Math.max(...days.map((day) => day.hours), 1);

    return (
        <section className="emp-home-chart">
            <div className="emp-home-section-head">
                <h2>Working Hours</h2>
                {!loading && total > 0 && <span className="emp-home-chart-total">{total.toFixed(1)}h this week</span>}
            </div>

            {loading ? (
                <div className="emp-home-chart-bars">
                    {[0, 1, 2, 3, 4, 5, 6].map((item) => (
                        <Skeleton key={item} variant="rounded" width="100%" height={48} sx={{ borderRadius: 2 }} />
                    ))}
                </div>
            ) : total > 0 ? (
                <div className="emp-home-chart-bars">
                    {days.map((day) => {
                        const height = Math.max(4, Math.round((day.hours / maxHours) * 64));
                        return (
                            <div className="emp-home-chart-col" key={day.label}>
                                <span className="emp-home-chart-value">
                                    {day.hours > 0 ? `${day.hours.toFixed(1)}h` : ""}
                                </span>
                                <span
                                    className={`emp-home-chart-bar${day.isToday ? " is-today" : ""}${day.hours > 0 ? " has-hours" : ""}`}
                                    style={{ height }}
                                />
                                <span className={`emp-home-chart-day${day.isToday ? " is-today" : ""}`}>
                                    {day.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="emp-home-chart-empty">
                    <AccessTimeOutlined sx={{ fontSize: 22 }} />
                    <span>Is hafte abhi koi hours nahi.</span>
                </div>
            )}
        </section>
    );
}

export default WorkingHoursChart;
