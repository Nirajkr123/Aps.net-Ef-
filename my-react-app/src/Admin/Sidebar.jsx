import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    DashboardOutlined,
    PeopleAltOutlined,
    SettingsOutlined,
    LogoutOutlined,
    ChevronLeft,
    Close,
    BoltOutlined,
    LocationCityOutlined,
    AccountTreeOutlined,
    BadgeOutlined,
    ListAltOutlined,
    EventAvailableOutlined,
    MapOutlined,
    ScheduleOutlined,
    AssignmentTurnedInOutlined,
    PaymentsOutlined,
    AccessTimeOutlined,
    CalendarMonthOutlined,
} from "@mui/icons-material";

import useIsMobile from "../hooks/useIsMobile";
import { useMobileSidebar } from "./mobileSidebar";

import "./Sidebar.css";

const ROUTE_MAP = {
    dashboard: "/dashboard",
    "my-dashboard": "/my-dashboard",
    "my-profile": "/my-profile",
    "my-attendance": "/my-attendance",
    "my-leaves": "/my-leaves",
    "my-payslips": "/my-payslips",
    departments: "/departments",
    designations: "/designations",
    directory: "/directory",
    employees: "/directory",
    /* HR/OWNER ka leave-approval module. Employee ka apna "My Leaves"
       alag route (`/my-leaves`) hai, isiliye key alag rakha. */
    leaves: "/admin/leaves",
    attendance: "/admin/attendance",
    "attendance-register": "/admin/attendance/register",
    payroll: "/payroll",
    shifts: "/shifts",
    "shift-assignments": "/shift-assignments",
    users: "/users",
    locations: "/locations",
    "work-locations": "/work-locations",
    settings: "/settings",
};

// =========================
// ROLE-BASED NAV CONFIG
// =========================

const ROLE_NAV_MAP = {
    OWNER: [
        { key: "dashboard", label: "Dashboard", icon: DashboardOutlined },
        { key: "departments", label: "Departments", icon: AccountTreeOutlined },
        { key: "designations", label: "Designations", icon: BadgeOutlined },
        { key: "directory", label: "Employee Directory", icon: ListAltOutlined },
        { key: "leaves", label: "Leave Requests", icon: EventAvailableOutlined },
        { key: "attendance", label: "Attendance", icon: AccessTimeOutlined },
        {
            key: "attendance-register",
            label: "Attendance Register",
            icon: CalendarMonthOutlined,
        },
        { key: "payroll", label: "Payroll", icon: PaymentsOutlined },
        { key: "shifts", label: "Shifts", icon: ScheduleOutlined },
        { key: "shift-assignments", label: "Shift Assign", icon: AssignmentTurnedInOutlined },
        { key: "users", label: "Admin & HR Users", icon: PeopleAltOutlined },
        { key: "locations", label: "Locations", icon: LocationCityOutlined },
        { key: "work-locations", label: "Work Locations", icon: MapOutlined },
        { key: "settings", label: "Settings", icon: SettingsOutlined },
    ],
    HR: [
        { key: "dashboard", label: "Dashboard", icon: DashboardOutlined },
        { key: "departments", label: "Departments", icon: AccountTreeOutlined },
        { key: "designations", label: "Designations", icon: BadgeOutlined },
        { key: "directory", label: "Employee Directory", icon: ListAltOutlined },
        { key: "leaves", label: "Leave Requests", icon: EventAvailableOutlined },
        { key: "attendance", label: "Attendance", icon: AccessTimeOutlined },
        {
            key: "attendance-register",
            label: "Attendance Register",
            icon: CalendarMonthOutlined,
        },
        { key: "payroll", label: "Payroll", icon: PaymentsOutlined },
        { key: "shifts", label: "Shifts", icon: ScheduleOutlined },
        { key: "shift-assignments", label: "Shift Assign", icon: AssignmentTurnedInOutlined },
        { key: "users", label: "Admin & HR Users", icon: PeopleAltOutlined },
        { key: "work-locations", label: "Work Locations", icon: MapOutlined },
        { key: "settings", label: "Settings", icon: SettingsOutlined },
    ],
    EMPLOYEE: [
        { key: "my-dashboard", label: "My Dashboard", icon: DashboardOutlined },
        { key: "settings", label: "Settings", icon: SettingsOutlined },
    ],
};

const DEFAULT_NAV_ITEMS = ROLE_NAV_MAP.OWNER;

function Sidebar({
    activeKey = "dashboard",
    onLogout = () => {},
    title = "Asp Admin",
    user = null,
    navItems,
    collapsed = false,
    onToggleCollapse = () => {},
    profilePhotoUrl = null,
}) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [mobileOpen, { close: closeMobileSidebar }] = useMobileSidebar();
    const role = user?.role || "OWNER";
    const items = useMemo(() => {
        if (navItems) return navItems;
        return ROLE_NAV_MAP[role] || DEFAULT_NAV_ITEMS;
    }, [navItems, role]);
    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email ||
          "User"
        : "Guest";

    const roleLabel = user?.role || "Administrator";

    const initial = (displayName || "U").charAt(0).toUpperCase();

    const railOnly = collapsed && !isMobile;
    const sidebarClass = [
        "sidebar",
        railOnly ? "collapsed" : "",
        isMobile ? "sidebar-mobile" : "",
        isMobile && mobileOpen ? "sidebar-mobile-open" : "",
    ]
        .filter(Boolean)
        .join(" ");

    useEffect(() => {
        if (!isMobile) closeMobileSidebar();
    }, [isMobile, closeMobileSidebar]);

    useEffect(() => {
        if (!isMobile || !mobileOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") closeMobileSidebar();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isMobile, mobileOpen, closeMobileSidebar]);

    const handleNavClick = (key) => {
        const path = ROUTE_MAP[key];
        if (path) navigate(path);
        if (isMobile) closeMobileSidebar();
    };

    const handleHeaderButton = () => {
        if (isMobile) {
            closeMobileSidebar();
            return;
        }
        onToggleCollapse();
    };

    return (
        <>
        <div
            className={sidebarClass}
            id="app-sidebar"
            aria-hidden={isMobile && !mobileOpen ? "true" : undefined}
        >

            {/* LOGO */}
            <div className="sidebar-logo-wrap">
                <div className="sidebar-logo-badge">
                    <BoltOutlined fontSize="inherit" />
                </div>
                {!railOnly && (
                    <div className="sidebar-logo-copy">
                        <span className="sidebar-logo-text">{title}</span>
                        <span className="sidebar-logo-subtitle">Workspace</span>
                    </div>
                )}
                <button
                    type="button"
                    className="sidebar-collapse-btn"
                    aria-label={
                        isMobile
                            ? "Close navigation menu"
                            : railOnly
                              ? "Expand sidebar"
                              : "Collapse sidebar"
                    }
                    onClick={handleHeaderButton}
                >
                    {isMobile ? (
                        <Close fontSize="small" />
                    ) : (
                        <ChevronLeft fontSize="small" />
                    )}
                </button>
            </div>

            {/* DYNAMIC USER PROFILE */}
            {user && (
                <div className="sidebar-user" title={railOnly ? displayName : undefined}>
                    <div className="sidebar-user-avatar">
                        {profilePhotoUrl ? (
                            <img src={profilePhotoUrl} alt={displayName} className="sidebar-user-photo" />
                        ) : (
                            initial
                        )}
                        <span className="sidebar-user-status" aria-hidden="true" />
                    </div>
                    {!railOnly && (
                        <div className="sidebar-user-meta">
                            <p className="sidebar-user-name">{displayName}</p>
                            <span className="sidebar-user-role">{roleLabel}</span>
                        </div>
                    )}
                </div>
            )}

            {/* NAV */}
            <nav className="sidebar-nav" aria-label="Main navigation">
                {!railOnly && <span className="sidebar-nav-caption">Navigation</span>}
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.key === activeKey;

                    return (
                        <div
                            key={item.key}
                            className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                            title={railOnly ? item.label : undefined}
                            role="button"
                            tabIndex={0}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => handleNavClick(item.key)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleNavClick(item.key);
                                }
                            }}
                        >
                            <span className="sidebar-nav-icon">
                                <Icon fontSize="inherit" />
                            </span>
                            {!railOnly && (
                                <span className="sidebar-nav-label">{item.label}</span>
                            )}
                            {isActive && (
                                <span className="sidebar-nav-active-mark" aria-hidden="true" />
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* SPACER */}
            <div className="sidebar-spacer" />

            {/* LOGOUT */}
            <div
                className="sidebar-logout"
                title={railOnly ? "Logout" : undefined}
                role="button"
                tabIndex={0}
                aria-label="Logout"
                onClick={onLogout}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onLogout();
                    }
                }}
            >
                <span className="sidebar-nav-icon">
                    <LogoutOutlined fontSize="inherit" />
                </span>
                {!railOnly && (
                    <span className="sidebar-nav-label">Logout</span>
                )}
            </div>

        </div>

        {isMobile && (
            <div
                className={`sidebar-backdrop ${mobileOpen ? "open" : ""}`}
                onClick={closeMobileSidebar}
                aria-hidden="true"
            />
        )}
        </>
    );
}

export default Sidebar;
