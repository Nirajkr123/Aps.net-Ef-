import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    AccessTimeOutlined,
    EventOutlined,
    HomeOutlined,
    PersonOutlined,
} from "@mui/icons-material";

const ITEMS = [
    { label: "Home", path: "/my-dashboard", icon: <HomeOutlined /> },
    { label: "Attendance", path: "/my-attendance", icon: <AccessTimeOutlined /> },
    { label: "Leaves", path: "/my-leaves", icon: <EventOutlined /> },
    { label: "Profile", path: "/my-profile", icon: <PersonOutlined /> },
];

function BottomNav() {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    return (
        <nav className="emp-bottom-nav" aria-label="Mobile navigation">
            {ITEMS.map((item) => {
                const active = pathname === item.path;
                return (
                    <button
                        key={item.path}
                        type="button"
                        className={`emp-bottom-nav-item${active ? " is-active" : ""}`}
                        onClick={() => navigate(item.path)}
                        aria-current={active ? "page" : undefined}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

export default BottomNav;
