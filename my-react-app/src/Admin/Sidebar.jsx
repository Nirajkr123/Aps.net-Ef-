import React from "react";
import {
    DashboardOutlined,
    PeopleAltOutlined,
    BarChartOutlined,
    SettingsOutlined,
    LogoutOutlined,
    ChevronLeft,
    BoltOutlined,
    LocationCityOutlined,
} from "@mui/icons-material";

import "./Sidebar.css";

// =========================
// DEFAULT NAV CONFIG
// Can be overridden via the `navItems` prop (dynamic)
// =========================

const DEFAULT_NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", icon: DashboardOutlined },
    { key: "users", label: "Users", icon: PeopleAltOutlined },
    { key: "reports", label: "Reports", icon: BarChartOutlined },
    { key: "locations", label: "Locations", icon: LocationCityOutlined },
    { key: "settings", label: "Settings", icon: SettingsOutlined },
];

function Sidebar({
    activeKey = "dashboard",
    onNavigate = () => {},
    onLogout = () => {},
    title = "Asp Admin",
    user = null,
    navItems = DEFAULT_NAV_ITEMS,
    collapsed = false,
    onToggleCollapse = () => {},
}) {
    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email ||
          "User"
        : "Guest";

    const roleLabel = user?.role || "Administrator";

    const initial = (displayName || "U").charAt(0).toUpperCase();

    return (
        <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>

            {/* LOGO */}
            <div className="sidebar-logo-wrap">
                <div className="sidebar-logo-badge">
                    <BoltOutlined fontSize="inherit" />
                </div>
                {!collapsed && (
                    <span className="sidebar-logo-text">{title}</span>
                )}
                <button
                    type="button"
                    className="sidebar-collapse-btn"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    onClick={onToggleCollapse}
                >
                    <ChevronLeft fontSize="small" />
                </button>
            </div>

            {/* DYNAMIC USER PROFILE */}
            {user && (
                <div className="sidebar-user" title={collapsed ? displayName : undefined}>
                    <div className="sidebar-user-avatar">{initial}</div>
                    {!collapsed && (
                        <div className="sidebar-user-meta">
                            <p className="sidebar-user-name">{displayName}</p>
                            <p className="sidebar-user-role">{roleLabel}</p>
                        </div>
                    )}
                </div>
            )}

            {/* NAV */}
            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.key === activeKey;

                    return (
                        <div
                            key={item.key}
                            className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                            title={collapsed ? item.label : undefined}
                            onClick={() => onNavigate(item.key)}
                        >
                            <span className="sidebar-nav-icon">
                                <Icon fontSize="inherit" />
                            </span>
                            {!collapsed && (
                                <span className="sidebar-nav-label">{item.label}</span>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* SPACER */}
            <div className="sidebar-spacer" />

            {/* UPGRADE CARD */}
            {!collapsed && (
                <div className="sidebar-upgrade">
                    <p className="sidebar-upgrade-title">Upgrade to Pro</p>
                    <p className="sidebar-upgrade-text">
                        Unlock advanced analytics & unlimited seats.
                    </p>
                    <button type="button" className="sidebar-upgrade-btn">
                        Upgrade
                    </button>
                </div>
            )}

            {/* LOGOUT */}
            <div
                className="sidebar-logout"
                title={collapsed ? "Logout" : undefined}
                onClick={onLogout}
            >
                <span className="sidebar-nav-icon">
                    <LogoutOutlined fontSize="inherit" />
                </span>
                {!collapsed && (
                    <span className="sidebar-nav-label">Logout</span>
                )}
            </div>

        </div>
    );
}

export default Sidebar;
