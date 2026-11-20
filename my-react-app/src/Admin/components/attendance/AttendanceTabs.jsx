import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarMonthRounded, TodayRounded } from "@mui/icons-material";

import "./AttendanceRegister.css";

const TABS = [
    {
        key: "daily",
        label: "Daily",
        description: "Punches by date",
        to: "/admin/attendance",
        icon: TodayRounded,
    },
    {
        key: "register",
        label: "Monthly Register",
        description: "Employee × day grid",
        to: "/admin/attendance/register",
        icon: CalendarMonthRounded,
    },
];

function AttendanceTabs({ active }) {
    const navigate = useNavigate();
    const location = useLocation();
    const current = active || (location.pathname.endsWith("/register") ? "register" : "daily");

    return (
        <div className="att-tabs" role="tablist" aria-label="Attendance views">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const selected = current === tab.key;

                return (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={`att-tab${selected ? " is-active" : ""}`}
                        onClick={() => {
                            if (!selected) navigate(tab.to);
                        }}
                    >
                        <Icon fontSize="small" />
                        <span>
                            <strong>{tab.label}</strong>
                            <small>{tab.description}</small>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export default AttendanceTabs;
