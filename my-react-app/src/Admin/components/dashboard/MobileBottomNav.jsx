import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    EventAvailableOutlined,
    HomeOutlined,
    MoreHorizOutlined,
    PaymentsOutlined,
    PeopleAltOutlined,
} from "@mui/icons-material";

const ITEMS = [
    { key: "home", label: "Home", icon: HomeOutlined, path: "/dashboard" },
    { key: "employees", label: "Employees", icon: PeopleAltOutlined, path: "/directory" },
    { key: "leaves", label: "Leaves", icon: EventAvailableOutlined, path: "/admin/leaves" },
    { key: "payroll", label: "Payroll", icon: PaymentsOutlined, path: "/payroll" },
    { key: "more", label: "More", icon: MoreHorizOutlined },
];

const MORE_ROUTES = [
    "/departments",
    "/designations",
    "/shifts",
    "/shift-assignments",
    "/users",
    "/locations",
    "/work-locations",
    "/admin/attendance",
    "/settings",
];

function isItemActive(item, pathname) {
    if (item.key === "more") {
        return MORE_ROUTES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    }

    if (item.key === "employees") {
        return pathname === "/directory" || pathname === "/employees";
    }

    return pathname === item.path;
}

function MobileBottomNav({ onMore }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    return (
        <nav className="owner-bottom-nav" aria-label="Mobile navigation">
            {ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item, pathname);

                return (
                    <button
                        key={item.key}
                        type="button"
                        className={`owner-bottom-nav-item${active ? " is-active" : ""}`}
                        onClick={() => {
                            if (item.key === "more") onMore();
                            else navigate(item.path);
                        }}
                        aria-current={active ? "page" : undefined}
                    >
                        <Icon />
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

export default MobileBottomNav;
