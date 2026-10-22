import React, { useState } from "react";
import {
    Search,
    MenuOpen,
    Menu,
    PersonOutlined,
    SettingsOutlined,
    LogoutOutlined,
    Close,
} from "@mui/icons-material";
import { Dialog, DialogTitle, DialogContent, IconButton, Chip } from "@mui/material";

import NotificationBell from "../Employee/components/NotificationBell";
import useIsMobile from "../hooks/useIsMobile";
import { useMobileSidebar } from "./mobileSidebar";

import "./Navbar.css";

function Navbar({
    search = "",
    onSearchChange = () => {},
    searchPlaceholder = "Search users, emails...",
    userName = "Admin",
    userRole = "Administrator",
    user = null,
    onNotificationsClick = () => {},
    notificationCount = 0,
    collapsed = false,
    onToggleSidebar = () => {},
    onLogout = () => {},
    onNavigate = () => {},
    profilePhotoUrl = null,
}) {
    const [anchorEl, setAnchorEl] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const open = Boolean(anchorEl);

    const isMobile = useIsMobile();
    const [mobileOpen, { toggle: toggleMobileSidebar }] = useMobileSidebar();

    const handleToggleSidebar = () => {
        if (isMobile) {
            toggleMobileSidebar();
            return;
        }
        onToggleSidebar();
    };

    const handleMenuOpen = (e) => {
        setAnchorEl(e.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleViewProfile = () => {
        handleMenuClose();
        setProfileOpen(true);
    };

    const handleSettings = () => {
        handleMenuClose();
        onNavigate("settings");
    };

    const handleLogout = () => {
        handleMenuClose();
        onLogout();
    };

    const initials = (s) => (s || "?").charAt(0).toUpperCase();

    return (
        <div className="navbar">
            <div className="navbar-left">
                <button
                    className="navbar-toggle-btn"
                    type="button"
                    aria-label={
                        isMobile
                            ? mobileOpen
                                ? "Close navigation menu"
                                : "Open navigation menu"
                            : "Toggle sidebar"
                    }
                    aria-expanded={isMobile ? mobileOpen : !collapsed}
                    aria-controls="app-sidebar"
                    onClick={handleToggleSidebar}
                >
                    {isMobile ? (
                        mobileOpen ? (
                            <Close fontSize="small" />
                        ) : (
                            <Menu fontSize="small" />
                        )
                    ) : collapsed ? (
                        <Menu fontSize="small" />
                    ) : (
                        <MenuOpen fontSize="small" />
                    )}
                </button>

                <div className="navbar-search-wrap">
                    <span className="navbar-search-icon">
                        <Search fontSize="inherit" />
                    </span>
                    <input
                        className="navbar-search-input"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    <span className="navbar-search-kbd">/</span>
                </div>
            </div>

            <div className="navbar-right">
                <NotificationBell />

                <div className="navbar-profile" onClick={handleMenuOpen}>
                    <div className="navbar-avatar">
                        {profilePhotoUrl ? (
                            <img src={profilePhotoUrl} alt={userName} className="navbar-avatar-photo" />
                        ) : (
                            userName.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div className="navbar-profile-meta">
                        <p className="navbar-profile-name">{userName}</p>
                        <p className="navbar-profile-role">{userRole}</p>
                    </div>
                </div>

                {/* Profile Dropdown Menu */}
                <div className={`navbar-dropdown ${open ? "open" : ""}`}>
                    {open && (
                        <>
                            <div className="navbar-dropdown-overlay" onClick={handleMenuClose} />
                            <div className="navbar-dropdown-menu">
                                <div className="navbar-dropdown-header">
                                    <div className="navbar-dropdown-avatar">
                                        {profilePhotoUrl ? (
                                            <img src={profilePhotoUrl} alt={userName} className="navbar-avatar-photo" />
                                        ) : (
                                            userName.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <p className="navbar-dropdown-name">{userName}</p>
                                        <p className="navbar-dropdown-role">{userRole}</p>
                                    </div>
                                </div>
                                <div className="navbar-dropdown-divider" />
                                <button className="navbar-dropdown-item" onClick={handleViewProfile}>
                                    <PersonOutlined fontSize="small" />
                                    <span>View Profile</span>
                                </button>
                                <button className="navbar-dropdown-item" onClick={handleSettings}>
                                    <SettingsOutlined fontSize="small" />
                                    <span>Settings</span>
                                </button>
                                <div className="navbar-dropdown-divider" />
                                <button className="navbar-dropdown-item navbar-dropdown-logout" onClick={handleLogout}>
                                    <LogoutOutlined fontSize="small" />
                                    <span>Logout</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* My Profile Dialog */}
                <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle className="modal-title">
                        My Profile
                        <IconButton className="modal-close" onClick={() => setProfileOpen(false)} size="small">
                            <Close fontSize="small" />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent className="modal-body view-body">
                        <div className="view-avatar">
                            {profilePhotoUrl ? (
                                <img src={profilePhotoUrl} alt={userName} className="navbar-avatar-photo" />
                            ) : (
                                initials(userName)
                            )}
                        </div>
                        <p className="view-name">{userName}</p>
                        <p className="view-email">{user?.email || "—"}</p>
                        <div className="view-meta">
                            <div className="view-meta-item">
                                <span className="view-meta-label">Role</span>
                                <Chip label={userRole} size="small" />
                            </div>
                            <div className="view-meta-item">
                                <span className="view-meta-label">User ID</span>
                                <span className="view-meta-value">#{user?.id || "—"}</span>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

export default Navbar;
