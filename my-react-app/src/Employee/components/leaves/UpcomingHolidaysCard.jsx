import React, { useEffect, useState } from "react";
import { Card } from "@mui/material";
import { CelebrationOutlined } from "@mui/icons-material";
import holidayServ from "../../../services/holidayService";
import { formatDate } from "./leaveShared";

function UpcomingHolidaysCard() {
    const [holidays, setHolidays] = useState([]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const { data } = await holidayServ.getUpcoming();
                const rows = Array.isArray(data) ? data : data?.items || data?.data || [];
                const next = rows
                    .filter((holiday) => holiday?.date)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .slice(0, 3);

                if (active) setHolidays(next);
            } catch {
                if (active) setHolidays([]);
            }
        };

        load();

        return () => {
            active = false;
        };
    }, []);

    if (holidays.length === 0) return null;

    return (
        <Card component="section" elevation={0} className="emp-leave-holidays" aria-label="Upcoming holidays">
            <div className="emp-leave-holidays-head">
                <span aria-hidden="true">
                    <CelebrationOutlined />
                </span>
                <h2>Upcoming holidays</h2>
            </div>

            <div className="emp-leave-holidays-list">
                {holidays.map((holiday) => (
                    <div
                        className="emp-leave-holiday-row"
                        key={holiday.id || `${holiday.name}-${holiday.date}`}
                    >
                        <strong>{holiday.name || "Holiday"}</strong>
                        <span>{formatDate(holiday.date)}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

export default UpcomingHolidaysCard;
