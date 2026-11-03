import React from "react";
import { Skeleton } from "@mui/material";
import { AccessTimeOutlined } from "@mui/icons-material";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function WorkingHoursCard({ days = [], total = 0, loading = false }) {
    const weekdays = WEEKDAYS.map((label) => (
        days.find((day) => day.label === label) || { label, hours: 0, isToday: false }
    ));
    const maxHours = Math.max(...weekdays.map((day) => Number(day.hours) || 0), 1);
    const hasHours = Number(total) > 0 || weekdays.some((day) => Number(day.hours) > 0);

    return (
        <section className="emp-profile-card emp-profile-hours-card">
            <div className="emp-profile-hours-head">
                <h2>Working Hours</h2>
                <span className="emp-profile-chip">This week</span>
            </div>

            {loading ? (
                <div className="emp-profile-hours-bars">
                    {WEEKDAYS.map((day) => (
                        <Skeleton
                            key={day}
                            variant="rounded"
                            width="100%"
                            height={54}
                            sx={{ borderRadius: 2 }}
                        />
                    ))}
                </div>
            ) : hasHours ? (
                <div className="emp-profile-hours-bars">
                    {weekdays.map((day) => {
                        const hours = Number(day.hours) || 0;
                        const height = Math.max(4, Math.round((hours / maxHours) * 56));

                        return (
                            <div className="emp-profile-hours-col" key={day.label}>
                                <span className="emp-profile-hours-value">
                                    {hours > 0 ? `${hours.toFixed(1)}h` : ""}
                                </span>
                                <span
                                    className={`emp-profile-hours-bar${hours > 0 ? " has-hours" : ""}${day.isToday ? " is-today" : ""}`}
                                    style={{ height }}
                                />
                                <span className={`emp-profile-hours-day${day.isToday ? " is-today" : ""}`}>
                                    {day.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="emp-profile-hours-empty">
                    <AccessTimeOutlined />
                    <span>Is hafte abhi koi hours nahi.</span>
                </div>
            )}
        </section>
    );
}

export default WorkingHoursCard;
