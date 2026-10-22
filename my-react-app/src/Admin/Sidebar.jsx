import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    DashboardOutlined,
    PeopleAltOutlined,
    BarChartOutlined,
    SettingsOutlined,
    LogoutOutlined,
    ChevronLeft,
    Close,
    BoltOutlined,
    LocationCityOutlined,
    AccountTreeOutlined,
    BadgeOutlined,
    FolderCopyOutlined,
    ListAltOutlined,
    EventAvailableOutlined,
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
    users: "/users",
    locations: "/locations",
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
        { key: "users", label: "Users", icon: PeopleAltOutlined },
        { key: "locations", label: "Locations", icon: LocationCityOutlined },
        { key: "settings", label: "Settings", icon: SettingsOutlined },
    ],
    HR: [
        { key: "dashboard", label: "Dashboard", icon: DashboardOutlined },
        { key: "departments", label: "Departments", icon: AccountTreeOutlined },
        { key: "designations", label: "Designations", icon: BadgeOutlined },
        { key: "directory", label: "Employee Directory", icon: ListAltOutlined },
        { key: "leaves", label: "Leave Requests", icon: EventAvailableOutlined },
        { key: "users", label: "Users", icon: PeopleAltOutlined },
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
                    <span className="sidebar-logo-text">{title}</span>
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
                    </div>
                    {!railOnly && (
                        <div className="sidebar-user-meta">
                            <p className="sidebar-user-name">{displayName}</p>
                            <p className="sidebar-user-role">{roleLabel}</p>
                        </div>
                    )}
                </div>
            )}

            {/* NAV */}
            <nav className="sidebar-nav">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.key === activeKey;

                    return (
                        <div
                            key={item.key}
                            className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                            title={railOnly ? item.label : undefined}
                            onClick={() => handleNavClick(item.key)}
                        >
                            <span className="sidebar-nav-icon">
                                <Icon fontSize="inherit" />
                            </span>
                            {!railOnly && (
                                <span className="sidebar-nav-label">{item.label}</span>
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
                onClick={onLogout}
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
