import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import {
    Chip,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Menu,
    MenuItem,
    Divider,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Paper,
    FormControl,
    InputLabel,
    Select,
    Snackbar,
    Alert,
} from "@mui/material";
import {
    MoreVert,
    Add,
    Search,
    VisibilityOutlined,
    EditOutlined,
    LockReset,
    Block,
    CheckCircle,
    DeleteOutlineOutlined,
    BadgeOutlined,
    Close,
    Group,
    CheckCircleOutlined,
    BlockOutlined,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

import "./AdminDashboard.css";
import "./UserManagement.css";

const STATUS_COLORS = {
    Active: "success",
    Inactive: "error",
};

const EMPTY_FORM = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    currentPassword: "",
    role: "User",
    stateId: "",
    districtId: "",
    status: "Active",
};

function formatLastLogin(value) {
    if (!value) return "Never";
    const date = new Date(value);
    const now = new Date();
    const diffH = Math.floor((now - date) / 3600000);
    if (diffH < 24 && now.getDate() === date.getDate()) {
        return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffH < 48) return "Yesterday";
    if (diffH < 168) return `${Math.floor(diffH / 24)} days ago`;
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function UserManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dateFilter = searchParams.get("filter") || "";
    const [user, setUser] = useState(null);
    const isAdmin = user?.role === "Admin";
    const [collapsed, setCollapsed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [users, setUsers] = useState([]);
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [allDistricts, setAllDistricts] = useState([]);

    // Filters
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [stateFilter, setStateFilter] = useState("");
    const [districtFilter, setDistrictFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [activeStatFilter, setActiveStatFilter] = useState("");

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Action menu
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [menuUser, setMenuUser] = useState(null);

    // Dialogs
    const [addOpen, setAddOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [viewUser, setViewUser] = useState(null);
    const [roleUser, setRoleUser] = useState(null);
    const [resetUser, setResetUser] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Form state
    const [form, setForm] = useState({});
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    // Toast
    const [toast, setToast] = useState({ text: "", type: "success", open: false });

    const notifRef = useRef(null);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifReadIds, setNotifReadIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem("notifReadIds")) || []; } catch { return []; }
    });

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch {
            setUser(null);
        }
    }, []);

    const showToast = (text, type = "success") =>
        setToast({ text, type, open: true });

    const handleLogout = async () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        await signOut(auth);
        navigate("/login");
    };

    const getToken = () => localStorage.getItem("token");

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/Admin/users", {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (res.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login", { replace: true });
                return;
            }
            if (!res.ok) throw new Error("Failed to load users");
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load users error:", err);
            setError("Could not load users. Please check the server and try again.");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const loadStates = useCallback(async () => {
        try {
            const res = await fetch("/api/Admin/states", {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (res.ok) {
                const data = await res.json();
                setStates(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Load states error:", err);
        }
    }, []);

    const loadDistricts = useCallback(async (stateId) => {
        try {
            const url = stateId
                ? `/api/Admin/districts?stateId=${stateId}`
                : "/api/Admin/districts";
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : [];
                setDistricts(list);
                if (!stateId) setAllDistricts(list);
            }
        } catch (err) {
            console.error("Load districts error:", err);
        }
    }, []);

    useEffect(() => {
        loadUsers();
        loadStates();
        loadDistricts();
    }, [loadUsers, loadStates, loadDistricts]);

    const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Admin";

    // Reset district filter when state changes
    useEffect(() => {
        if (stateFilter) loadDistricts(stateFilter);
        else setDistrictFilter("");
    }, [stateFilter, loadDistricts]);

    const districtOptions = useMemo(() => {
        if (stateFilter) return districts;
        return [];
    }, [stateFilter, districts]);

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        const now = new Date();
        return users.filter((u) => {
            const name = [u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase();
            const email = (u.email || "").toLowerCase();
            if (q && !name.includes(q) && !email.includes(q)) return false;
            if (roleFilter && u.role !== roleFilter) return false;
            if (stateFilter && u.stateId !== Number(stateFilter)) return false;
            if (districtFilter && u.districtId !== Number(districtFilter)) return false;
            if (statusFilter && u.status !== statusFilter) return false;
            if (activeStatFilter === "active" && u.status !== "Active") return false;
            if (activeStatFilter === "inactive" && u.status === "Active") return false;
            if (dateFilter && u.createdAt) {
                const created = new Date(u.createdAt);
                if (dateFilter === "today") {
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (created < todayStart) return false;
                } else if (dateFilter === "week" || dateFilter === "trend") {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (created < weekAgo) return false;
                }
            } else if (dateFilter && !u.createdAt) {
                return false;
            }
            return true;
        });
    }, [users, search, roleFilter, stateFilter, districtFilter, statusFilter, activeStatFilter, dateFilter]);

    const roles = useMemo(
        () => [...new Set(users.map((u) => u.role).filter(Boolean))],
        [users]
    );

    const userStats = useMemo(() => {
        const total = users.length;
        const active = users.filter((u) => u.status === "Active").length;
        const inactive = users.filter((u) => u.status !== "Active").length;
        return { total, active, inactive };
    }, [users]);

    const openMenu = (event, u) => {
        setMenuAnchor(event.currentTarget);
        setMenuUser(u);
    };
    const closeMenu = () => {
        setMenuAnchor(null);
        setMenuUser(null);
    };

    const handleView = () => {
        setViewUser(menuUser);
        closeMenu();
    };
    const handleEdit = () => {
        setEditUser(menuUser);
        setForm({
            firstName: menuUser.firstName || "",
            lastName: menuUser.lastName || "",
            email: menuUser.email || "",
            role: menuUser.role || "User",
            stateId: menuUser.stateId || "",
            districtId: menuUser.districtId || "",
            status: menuUser.status || "Active",
        });
        if (menuUser.stateId) loadDistricts(menuUser.stateId);
        else setDistricts([]);
        setFormError("");
        closeMenu();
    };
    const handleRole = () => {
        setRoleUser(menuUser);
        setForm((f) => ({ ...f, role: menuUser.role || "User" }));
        setFormError("");
        closeMenu();
    };
    const handleReset = () => {
        setResetUser(menuUser);
        setForm((f) => ({ ...f, password: "", currentPassword: "" }));
        setFormError("");
        closeMenu();
    };
    const handleDeleteOpen = () => {
        setDeleteTarget(menuUser);
        closeMenu();
    };

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setDistricts([]);
        setFormError("");
        setAddOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        if (name === "stateId") {
            setForm((f) => ({ ...f, districtId: "" }));
            if (value) loadDistricts(value);
            else setDistricts([]);
        }
    };

    const assignState = async (res) => {
        if (res.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login", { replace: true });
            return null;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setFormError(data.message || "Something went wrong");
            return null;
        }
        return data;
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setFormError("");
        setSaving(true);
        try {
            const payload = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                password: form.password,
                role: form.role,
                stateId: form.stateId ? Number(form.stateId) : null,
                districtId: form.districtId ? Number(form.districtId) : null,
            };
            const res = await fetch("/api/User/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await assignState(res);
            if (!result) return;
            setAddOpen(false);
            showToast("User created successfully!");
            await loadUsers();
        } catch (err) {
            console.error("Add user error:", err);
            setFormError("Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setFormError("");
        setSaving(true);
        try {
            const payload = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                role: form.role,
                stateId: form.stateId ? Number(form.stateId) : null,
                districtId: form.districtId ? Number(form.districtId) : null,
                status: form.status,
            };
            const res = await fetch(`/api/Admin/users/${editUser.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify(payload),
            });
            const result = await assignState(res);
            if (!result) return;
            setEditUser(null);
            showToast("User updated successfully!");
            await loadUsers();
        } catch (err) {
            console.error("Edit user error:", err);
            setFormError("Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    const handleStatusToggle = async (u) => {
        const target = u.status === "Active" ? "Inactive" : "Active";
        const endpoint = target === "Active" ? "activate" : "deactivate";
        try {
            const res = await fetch(`/api/Admin/users/${u.id}/${endpoint}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (res.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login", { replace: true });
                return;
            }
            if (!res.ok) throw new Error("Failed");
            showToast(`User ${target.toLowerCase()} successfully!`);
            await loadUsers();
        } catch (err) {
            console.error("Status toggle error:", err);
            showToast("Failed to update status", "error");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/Admin/users/${deleteTarget.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (res.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login", { replace: true });
                return;
            }
            if (!res.ok) throw new Error("Failed");
            setDeleteTarget(null);
            showToast("User deleted successfully!");
            await loadUsers();
        } catch (err) {
            console.error("Delete error:", err);
            showToast("Failed to delete user", "error");
        }
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");
        setSaving(true);
        try {
            const res = await fetch(`/api/Admin/users/${roleUser.id}/role`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify({ role: form.role }),
            });
            const result = await assignState(res);
            if (!result) return;
            setRoleUser(null);
            showToast("Role updated successfully!");
            await loadUsers();
        } catch (err) {
            console.error("Role change error:", err);
            setFormError("Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        const isSelf = resetUser && user && resetUser.id === user.id;

        if (isSelf) {
            if (!form.currentPassword) {
                setFormError("Current password is required");
                return;
            }
        }

        if (!form.password) {
            setFormError("New password is required");
            return;
        }
        if (form.password.length < 8) {
            setFormError("New password must be at least 8 characters");
            return;
        }
        if (isSelf && form.currentPassword === form.password) {
            setFormError("New password must be different from current password");
            return;
        }

        setSaving(true);
        try {
            const body = isSelf
                ? { currentPassword: form.currentPassword, password: form.password }
                : { password: form.password };

            const res = await fetch(`/api/Admin/users/${resetUser.id}/reset-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify(body),
            });
            const result = await assignState(res);
            if (!result) return;
            setResetUser(null);
            showToast(isSelf ? "Password changed successfully!" : "Password reset successfully!");
        } catch (err) {
            console.error("Reset error:", err);
            setFormError("Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    // Normalize state/district for dialog selects
    const stateName = (sid) =>
        (states.find((s) => s.id === sid) || {}).name || "—";
    const districtName = (did) =>
        (allDistricts.find((d) => d.id === did) || {}).name || "—";

    // Notifications
    const notifications = users.slice(0, 5).map((u) => ({
        id: u.id,
        title: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
        sub: u.status === "Active" ? "Active member" : "Inactive member",
    }));

    const unreadNotifications = notifications.filter((n) => !notifReadIds.includes(n.id));

    const markNotifAsRead = (id) => {
        const updated = [...new Set([...notifReadIds, id])];
        setNotifReadIds(updated);
        localStorage.setItem("notifReadIds", JSON.stringify(updated));
    };

    const markAllNotifsAsRead = () => {
        const ids = notifications.map((n) => n.id);
        const updated = [...new Set([...notifReadIds, ...ids])];
        setNotifReadIds(updated);
        localStorage.setItem("notifReadIds", JSON.stringify(updated));
    };

    return (
        <div className="dash-page">
            <Sidebar
                activeKey="users"
                onNavigate={(key) => {
                    if (key === "dashboard") navigate("/dashboard");
                    else if (key === "users") navigate("/users");
                    else if (key === "locations") navigate("/locations");
                    else if (key === "reports") navigate("/dashboard");
                }}
                onLogout={handleLogout}
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
            />

            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by name or email..."
                    userName={displayName}
                    userRole={user?.role || "Administrator"}
                    user={user}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed((c) => !c)}
                    notificationCount={unreadNotifications.length}
                    onNotificationsClick={() => setNotifOpen((o) => !o)}
                    onLogout={handleLogout}
                    onNavigate={(key) => {
                        if (key === "settings") navigate("/settings");
                    }}
                />

                <div className="dash-content">
                    <div className="dash-header">
                        <div>
                            <h1 className="dash-title">User Management</h1>
                            <p className="dash-subtitle">
                                Manage all users and their access
                            </p>
                        </div>
                        <div className="dash-header-actions">
                            <button
                                type="button"
                                className="dash-btn dash-btn-primary"
                                onClick={openAdd}
                            >
                                <Add fontSize="small" />
                                New User
                            </button>
                        </div>
                    </div>

                    {loading && (
                        <div className="dash-loading">
                            <CircularProgress size={32} />
                            <p className="dash-loading-text">Loading users...</p>
                        </div>
                    )}

                    {error && !loading && <div className="dash-error">{error}</div>}

                    {!loading && !error && (
                        <>
                            {/* STAT CARDS */}
                            <div className="um-stats-grid">
                                <div
                                    className={`um-stat-card clickable ${activeStatFilter === "total" ? "um-stat-active" : ""}`}
                                    onClick={() => setActiveStatFilter(activeStatFilter === "total" ? "" : "total")}
                                >
                                    <div className="um-stat-top">
                                        <div className="um-stat-icon um-stat-icon-violet">
                                            <Group fontSize="inherit" />
                                        </div>
                                    </div>
                                    <p className="um-stat-value">{userStats.total}</p>
                                    <p className="um-stat-label">Total Users</p>
                                    <p className="um-stat-caption">All registered accounts</p>
                                </div>
                                <div
                                    className={`um-stat-card clickable ${activeStatFilter === "active" ? "um-stat-active" : ""}`}
                                    onClick={() => setActiveStatFilter(activeStatFilter === "active" ? "" : "active")}
                                >
                                    <div className="um-stat-top">
                                        <div className="um-stat-icon um-stat-icon-green">
                                            <CheckCircleOutlined fontSize="inherit" />
                                        </div>
                                    </div>
                                    <p className="um-stat-value">{userStats.active}</p>
                                    <p className="um-stat-label">Active Users</p>
                                    <p className="um-stat-caption">Currently active accounts</p>
                                </div>
                                <div
                                    className={`um-stat-card clickable ${activeStatFilter === "inactive" ? "um-stat-active" : ""}`}
                                    onClick={() => setActiveStatFilter(activeStatFilter === "inactive" ? "" : "inactive")}
                                >
                                    <div className="um-stat-top">
                                        <div className="um-stat-icon um-stat-icon-rose">
                                            <BlockOutlined fontSize="inherit" />
                                        </div>
                                    </div>
                                    <p className="um-stat-value">{userStats.inactive}</p>
                                    <p className="um-stat-label">Inactive Users</p>
                                    <p className="um-stat-caption">Disabled or locked accounts</p>
                                </div>
                            </div>

                            {(dateFilter || activeStatFilter) && (
                                <div className="um-filter-banner">
                                    <span className="um-filter-banner-text">
                                        Showing: {
                                            activeStatFilter === "total" ? "All Users" :
                                            activeStatFilter === "active" ? "Active Users" :
                                            activeStatFilter === "inactive" ? "Inactive Users" :
                                            dateFilter === "today" ? "Today's Signups" :
                                            dateFilter === "week" ? "This Week's Signups" :
                                            dateFilter === "trend" ? "7-Day Trend Users" :
                                            "All Users"
                                        }
                                        {" "} — {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
                                    </span>
                                    <button
                                        className="um-filter-banner-clear"
                                        onClick={() => {
                                            setActiveStatFilter("");
                                            if (dateFilter) navigate("/users");
                                        }}
                                    >
                                        Clear Filter ×
                                    </button>
                                </div>
                            )}

                        <Paper className="um-paper" elevation={0}>
                            {/* Filters */}
                            <div className="um-toolbar">
                                <div className="um-search">
                                    <Search fontSize="small" />
                                    <input
                                        className="um-search-input"
                                        placeholder="Search by name or email..."
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setPage(0);
                                        }}
                                    />
                                </div>

                                <FormControl className="um-select">
                                    <InputLabel>Role</InputLabel>
                                    <Select
                                        label="Role"
                                        value={roleFilter}
                                        onChange={(e) => {
                                            setRoleFilter(e.target.value);
                                            setPage(0);
                                        }}
                                    >
                                        <MenuItem value="">All Roles</MenuItem>
                                        {roles.map((r) => (
                                            <MenuItem key={r} value={r}>{r}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl className="um-select">
                                    <InputLabel>State</InputLabel>
                                    <Select
                                        label="State"
                                        value={stateFilter}
                                        onChange={(e) => {
                                            setStateFilter(e.target.value);
                                            setPage(0);
                                        }}
                                    >
                                        <MenuItem value="">All States</MenuItem>
                                        {states.map((s) => (
                                            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl className="um-select">
                                    <InputLabel>District</InputLabel>
                                    <Select
                                        label="District"
                                        value={districtFilter}
                                        disabled={!stateFilter}
                                        onChange={(e) => {
                                            setDistrictFilter(e.target.value);
                                            setPage(0);
                                        }}
                                    >
                                        <MenuItem value="">All Districts</MenuItem>
                                        {districtOptions.map((d) => (
                                            <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl className="um-select">
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        label="Status"
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                            setPage(0);
                                        }}
                                    >
                                        <MenuItem value="">All Status</MenuItem>
                                        <MenuItem value="Active">Active</MenuItem>
                                        <MenuItem value="Inactive">Inactive</MenuItem>
                                    </Select>
                                </FormControl>
                            </div>

                            {/* Table */}
                            <TableContainer className="um-table-container">
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Role</TableCell>
                                            <TableCell>State</TableCell>
                                            <TableCell>District</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Last Login</TableCell>
                                            <TableCell align="center">Action</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredUsers
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((u) => {
                                                const name =
                                                    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                                                    u.name ||
                                                    u.email;
                                                return (
                                                    <TableRow key={u.id} hover sx={{ cursor: "pointer" }} onClick={() => setViewUser(u)}>
                                                        <TableCell>
                                                            <div className="um-user-cell">
                                                                <div className="um-avatar">
                                                                    {(name || "?").charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="um-user-name">{name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="um-email">
                                                            {u.email}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={u.role || "User"}
                                                                size="small"
                                                                className={`um-role-chip ${u.role === "Admin" ? "admin" : ""}`}
                                                            />
                                                        </TableCell>
                                                        <TableCell>{u.state || stateName(u.stateId) || "—"}</TableCell>
                                                        <TableCell>{u.district || districtName(u.districtId) || "—"}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={u.status || "Active"}
                                                                size="small"
                                                                color={STATUS_COLORS[u.status] || "default"}
                                                                variant="outlined"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="um-lastlogin">
                                                            {formatLastLogin(u.lastLogin)}
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <IconButton
                                                                aria-label="More options"
                                                                onClick={(e) => openMenu(e, u)}
                                                                size="small"
                                                            >
                                                                <MoreVert fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        {filteredUsers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center" className="um-empty">
                                                    {search || roleFilter || stateFilter || districtFilter || statusFilter
                                                        ? "No users match your filters."
                                                        : "No users yet. Click 'New User' to add one."}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                component="div"
                                count={filteredUsers.length}
                                page={page}
                                onPageChange={(e, p) => setPage(p)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(e) => {
                                    setRowsPerPage(parseInt(e.target.value, 10));
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[5, 10, 25, 50]}
                            />
                        </Paper>
                        </>
                    )}
                </div>
            </div>

            {/* ======= NOTIFICATIONS DROPDOWN ======= */}
            <div className="notif-wrap">
                {notifOpen && (
                    <div className="notif-pop" ref={notifRef}>
                        <div className="notif-pop-head">
                            <span className="notif-pop-title">Notifications</span>
                            <span className="notif-pop-count">{unreadNotifications.length}</span>
                        </div>
                        <div className="notif-pop-list">
                            {notifications.length === 0 && (
                                <p className="notif-empty">No notifications yet.</p>
                            )}
                            {notifications.map((n) => (
                                <div
                                    className={`notif-item ${notifReadIds.includes(n.id) ? "notif-item-read" : ""}`}
                                    key={n.id}
                                    onClick={() => markNotifAsRead(n.id)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <span className="notif-item-dot" />
                                    <div className="notif-item-body">
                                        <p className="notif-item-title">
                                            {[users.find(u => u.id === n.id)?.firstName, users.find(u => u.id === n.id)?.lastName].filter(Boolean).join(" ") || n.title}
                                        </p>
                                        <p className="notif-item-sub">{n.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="notif-pop-footer" onClick={() => { markAllNotifsAsRead(); setNotifOpen(false); }}>
                            Mark all as read
                        </button>
                    </div>
                )}
            </div>

            {/* ======= ACTION MENU ======= */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={closeMenu}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ className: "pop-menu" }}
            >
                <MenuItem onClick={handleView} className="pop-menu-item">
                    <VisibilityOutlined fontSize="small" className="pop-menu-icon" />
                    View User
                </MenuItem>
                {isAdmin && (
                    <>
                        <MenuItem onClick={handleEdit} className="pop-menu-item">
                            <EditOutlined fontSize="small" className="pop-menu-icon" />
                            Edit User
                        </MenuItem>
                        <MenuItem onClick={handleRole} className="pop-menu-item">
                            <BadgeOutlined fontSize="small" className="pop-menu-icon" />
                            Change Role
                        </MenuItem>
                    </>
                )}
                {(isAdmin || (menuUser && user && menuUser.id === user.id)) && (
                    <MenuItem onClick={handleReset} className="pop-menu-item">
                        <LockReset fontSize="small" className="pop-menu-icon" />
                        {isAdmin ? "Reset Password" : "Change Password"}
                    </MenuItem>
                )}
                {isAdmin && (
                    <>
                        <Divider />
                        {menuUser && menuUser.status !== "Active" ? (
                            <MenuItem onClick={() => { handleStatusToggle(menuUser); closeMenu(); }} className="pop-menu-item">
                                <CheckCircle fontSize="small" className="pop-menu-icon" />
                                Activate
                            </MenuItem>
                        ) : (
                            <MenuItem onClick={() => { handleStatusToggle(menuUser); closeMenu(); }} className="pop-menu-item">
                                <Block fontSize="small" className="pop-menu-icon" />
                                Deactivate
                            </MenuItem>
                        )}
                        <Divider />
                        <MenuItem onClick={handleDeleteOpen} className="pop-menu-item danger">
                            <DeleteOutlineOutlined fontSize="small" className="pop-menu-icon" />
                            Delete
                        </MenuItem>
                    </>
                )}
            </Menu>

            {/* ======= ADD USER DIALOG ======= */}
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle className="modal-title">
                    Add New User
                    <IconButton className="modal-close" onClick={() => setAddOpen(false)} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <form onSubmit={handleAddSubmit}>
                    <DialogContent className="modal-body">
                        {formError && <div className="modal-error">{formError}</div>}
                        <div className="modal-grid">
                            <TextField label="First Name" name="firstName" value={form.firstName}
                                onChange={handleFormChange} fullWidth required />
                            <TextField label="Last Name" name="lastName" value={form.lastName}
                                onChange={handleFormChange} fullWidth required />
                            <TextField label="Email" name="email" type="email" value={form.email}
                                onChange={handleFormChange} fullWidth required sx={{ gridColumn: "1 / -1" }} />
                            <TextField label="Password" name="password" type="password" value={form.password}
                                onChange={handleFormChange} fullWidth required sx={{ gridColumn: "1 / -1" }} />

                            <FormControl fullWidth>
                                <InputLabel>Role</InputLabel>
                                <Select label="Role" name="role" value={form.role} onChange={handleFormChange}>
                                    <MenuItem value="User">User</MenuItem>
                                    <MenuItem value="Staff">Staff</MenuItem>
                                    <MenuItem value="Admin">Admin</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select label="Status" name="status" value={form.status} onChange={handleFormChange}>
                                    <MenuItem value="Active">Active</MenuItem>
                                    <MenuItem value="Inactive">Inactive</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl fullWidth>
                                <InputLabel>State</InputLabel>
                                <Select label="State" name="stateId" value={form.stateId} onChange={handleFormChange}>
                                    <MenuItem value="">Select State</MenuItem>
                                    {states.map((s) => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>District</InputLabel>
                                <Select label="District" name="districtId" value={form.districtId}
                                    disabled={!form.stateId} onChange={handleFormChange}>
                                    <MenuItem value="">Select District</MenuItem>
                                    {districts.map((d) => (
                                        <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>
                    </DialogContent>
                    <DialogActions className="modal-actions">
                        <Button onClick={() => setAddOpen(false)} className="modal-btn-cancel">Cancel</Button>
                        <Button type="submit" variant="contained" disabled={saving} className="modal-btn-submit">
                            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Create User"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* ======= EDIT USER DIALOG ======= */}
            <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} maxWidth="sm" fullWidth>
                <DialogTitle className="modal-title">
                    Edit User
                    <IconButton className="modal-close" onClick={() => setEditUser(null)} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <form onSubmit={handleEditSubmit}>
                    <DialogContent className="modal-body">
                        {formError && <div className="modal-error">{formError}</div>}
                        <div className="modal-grid">
                            <TextField label="First Name" name="firstName" value={form.firstName}
                                onChange={handleFormChange} fullWidth required />
                            <TextField label="Last Name" name="lastName" value={form.lastName}
                                onChange={handleFormChange} fullWidth required />
                            <TextField label="Email" name="email" type="email" value={form.email}
                                onChange={handleFormChange} fullWidth required sx={{ gridColumn: "1 / -1" }} />

                            <FormControl fullWidth>
                                <InputLabel>Role</InputLabel>
                                <Select label="Role" name="role" value={form.role} onChange={handleFormChange}>
                                    <MenuItem value="User">User</MenuItem>
                                    <MenuItem value="Staff">Staff</MenuItem>
                                    <MenuItem value="Admin">Admin</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select label="Status" name="status" value={form.status} onChange={handleFormChange}>
                                    <MenuItem value="Active">Active</MenuItem>
                                    <MenuItem value="Inactive">Inactive</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl fullWidth>
                                <InputLabel>State</InputLabel>
                                <Select label="State" name="stateId" value={form.stateId} onChange={handleFormChange}>
                                    <MenuItem value="">Select State</MenuItem>
                                    {states.map((s) => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>District</InputLabel>
                                <Select label="District" name="districtId" value={form.districtId}
                                    disabled={!form.stateId} onChange={handleFormChange}>
                                    <MenuItem value="">Select District</MenuItem>
                                    {districts.map((d) => (
                                        <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>
                    </DialogContent>
                    <DialogActions className="modal-actions">
                        <Button onClick={() => setEditUser(null)} className="modal-btn-cancel">Cancel</Button>
                        <Button type="submit" variant="contained" disabled={saving} className="modal-btn-submit">
                            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Save Changes"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* ======= VIEW USER DIALOG ======= */}
            <Dialog open={Boolean(viewUser)} onClose={() => setViewUser(null)} maxWidth="xs" fullWidth>
                <DialogTitle className="modal-title">
                    User Details
                    <IconButton className="modal-close" onClick={() => setViewUser(null)} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent className="modal-body view-body">
                    {viewUser && (
                        <>
                            <div className="view-avatar">
                                {(viewUser.firstName || viewUser.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <p className="view-name">
                                {[viewUser.firstName, viewUser.lastName].filter(Boolean).join(" ") || viewUser.email}
                            </p>
                            <p className="view-email">{viewUser.email}</p>
                            <div className="view-meta">
                                <div className="view-meta-item">
                                    <span className="view-meta-label">Role</span>
                                    <Chip label={viewUser.role || "User"} size="small" />
                                </div>
                                <div className="view-meta-item">
                                    <span className="view-meta-label">Status</span>
                                    <Chip label={viewUser.status || "Active"} size="small" color={STATUS_COLORS[viewUser.status] || "default"} variant="outlined" />
                                </div>
                                <div className="view-meta-item">
                                    <span className="view-meta-label">State</span>
                                    <span className="view-meta-value">{viewUser.state || stateName(viewUser.stateId) || "—"}</span>
                                </div>
                                <div className="view-meta-item">
                                    <span className="view-meta-label">District</span>
                                    <span className="view-meta-value">{viewUser.district || districtName(viewUser.districtId) || "—"}</span>
                                </div>
                                <div className="view-meta-item">
                                    <span className="view-meta-label">Last Login</span>
                                    <span className="view-meta-value">{formatLastLogin(viewUser.lastLogin)}</span>
                                </div>
                                <div className="view-meta-item">
                                    <span className="view-meta-label">User ID</span>
                                    <span className="view-meta-value">#{viewUser.id}</span>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ======= CHANGE ROLE DIALOG ======= */}
            <Dialog open={Boolean(roleUser)} onClose={() => setRoleUser(null)} maxWidth="xs" fullWidth>
                <DialogTitle className="modal-title">
                    Change Role
                    <IconButton className="modal-close" onClick={() => setRoleUser(null)} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <form onSubmit={handleRoleSubmit}>
                    <DialogContent className="modal-body">
                        {formError && <div className="modal-error">{formError}</div>}
                        <p className="confirm-text">
                            Changing role for{" "}
                            <strong>
                                {roleUser ? [roleUser.firstName, roleUser.lastName].filter(Boolean).join(" ") || roleUser.email : ""}
                            </strong>
                        </p>
                        <FormControl fullWidth>
                            <InputLabel>Role</InputLabel>
                            <Select label="Role" name="role" value={form.role} onChange={handleFormChange}>
                                <MenuItem value="User">User</MenuItem>
                                <MenuItem value="Staff">Staff</MenuItem>
                                <MenuItem value="Admin">Admin</MenuItem>
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions className="modal-actions">
                        <Button onClick={() => setRoleUser(null)} className="modal-btn-cancel">Cancel</Button>
                        <Button type="submit" variant="contained" disabled={saving} className="modal-btn-submit">
                            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Update Role"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* ======= RESET PASSWORD DIALOG ======= */}
            {(() => {
                const isSelf = resetUser && user && resetUser.id === user.id;
                return (
                    <Dialog open={Boolean(resetUser)} onClose={() => setResetUser(null)} maxWidth="xs" fullWidth>
                        <DialogTitle className="modal-title">
                            {isSelf ? "Change Password" : "Reset Password"}
                            <IconButton className="modal-close" onClick={() => setResetUser(null)} size="small">
                                <Close fontSize="small" />
                            </IconButton>
                        </DialogTitle>
                        <form onSubmit={handleResetSubmit}>
                            <DialogContent className="modal-body">
                                {formError && <div className="modal-error">{formError}</div>}
                                {!isSelf && (
                                    <p className="confirm-text">
                                        Reset password for{" "}
                                        <strong>
                                            {resetUser ? [resetUser.firstName, resetUser.lastName].filter(Boolean).join(" ") || resetUser.email : ""}
                                        </strong>
                                    </p>
                                )}
                                {isSelf && (
                                    <p className="confirm-text">
                                        Change your password. Enter your current password first.
                                    </p>
                                )}
                                {isSelf && (
                                    <TextField label="Current Password" name="currentPassword" type="password"
                                        value={form.currentPassword || ""} onChange={handleFormChange}
                                        fullWidth required sx={{ mt: 1 }} />
                                )}
                                <TextField label="New Password" name="password" type="password"
                                    value={form.password || ""} onChange={handleFormChange}
                                    fullWidth required sx={{ mt: isSelf ? 2 : 1 }} />
                                <p style={{ fontSize: "12px", color: "#9aa0b8", margin: "6px 0 0" }}>
                                    Must be at least 8 characters.
                                </p>
                            </DialogContent>
                            <DialogActions className="modal-actions">
                                <Button onClick={() => setResetUser(null)} className="modal-btn-cancel">Cancel</Button>
                                <Button type="submit" variant="contained" disabled={saving} className="modal-btn-submit">
                                    {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : (isSelf ? "Change Password" : "Reset Password")}
                                </Button>
                            </DialogActions>
                        </form>
                    </Dialog>
                );
            })()}

            {/* ======= DELETE CONFIRM DIALOG ======= */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle className="modal-title confirm-title">
                    Delete User
                    <IconButton className="modal-close" onClick={() => setDeleteTarget(null)} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent className="modal-body">
                    <p className="confirm-text">
                        Are you sure you want to delete{" "}
                        <strong>
                            {deleteTarget
                                ? [deleteTarget.firstName, deleteTarget.lastName].filter(Boolean).join(" ") || deleteTarget.email
                                : ""}
                        </strong>
                        ? This action cannot be undone.
                    </p>
                </DialogContent>
                <DialogActions className="modal-actions">
                    <Button onClick={() => setDeleteTarget(null)} className="modal-btn-cancel">Cancel</Button>
                    <Button onClick={handleDelete} className="modal-btn-danger">Delete</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setToast((t) => ({ ...t, open: false }))}
                    severity={toast.type}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {toast.text}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default UserManagement;
