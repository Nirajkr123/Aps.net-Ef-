import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Alert,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    TextField,
} from "@mui/material";
import {
    Add as AddIcon,
    BadgeOutlined,
    Block,
    CheckCircle,
    CloseRounded,
    DeleteOutlineOutlined,
    EditOutlined,
    GroupOutlined,
    LockReset,
    VisibilityOutlined,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import adminServ from "../services/adminService";

import "./AdminDashboard.css";
import "./UserManagement.css";

import {
    ConfirmModal,
    DataTable,
    EmptyState,
    FilterPills,
    FormDrawer,
    MobileCard,
    MobileCardList,
    PageHeader,
    Pagination,
    RowActions,
    SearchInput,
    StatusBadge,
} from "../components/admin";

const PAGE_SIZE = 10;
const MOBILE_BATCH = 5;

const EMPTY_FORM = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    currentPassword: "",
    role: "HR",
    stateId: "",
    districtId: "",
    status: "Active",
};

const formatLastLogin = (value) => {
    if (!value) return "Never";
    const date = new Date(value);
    const now = new Date();
    const diffH = Math.floor((now - date) / 3600000);
    if (diffH < 24 && now.getDate() === date.getDate()) {
        return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffH < 48) return "Yesterday";
    if (diffH < 168) return `${Math.floor(diffH / 24)} days ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const userName = (u) =>
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.name || u?.email || "Unnamed user";

const initialsOf = (u) => (userName(u) || "?").charAt(0).toUpperCase();

function UserManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dateFilter = searchParams.get("filter") || "";

    const [user, setUser] = useState(null);
    const isAdmin = user?.role === "OWNER" || user?.role === "HR";
    const isOwner = user?.role === "OWNER";

    const [collapsed, setCollapsed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [users, setUsers] = useState([]);
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [allDistricts, setAllDistricts] = useState([]);
    const [formDistricts, setFormDistricts] = useState([]);

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [stateFilter, setStateFilter] = useState("");
    const [districtFilter, setDistrictFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [page, setPage] = useState(0);
    const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const [viewUser, setViewUser] = useState(null);
    const [roleUser, setRoleUser] = useState(null);
    const [resetUser, setResetUser] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [toast, setToast] = useState({ text: "", type: "success", open: false });

    useEffect(() => {
        try {
            setUser(JSON.parse(localStorage.getItem("user") || "null"));
        } catch {
            setUser(null);
        }
    }, []);

    const showToast = (text, type = "success") => setToast({ text, type, open: true });

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const { data } = await adminServ.getUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load users error:", err);
            setError("Could not load users. Please check the server and try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadStates = useCallback(async () => {
        try {
            const { data } = await adminServ.getStates();
            setStates(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load states error:", err);
        }
    }, []);

    const loadAllDistricts = useCallback(async () => {
        try {
            const { data } = await adminServ.getDistricts();
            setAllDistricts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load districts error:", err);
        }
    }, []);

    const loadFilterDistricts = useCallback(async (stateId) => {
        if (!stateId) {
            setDistricts([]);
            return;
        }
        try {
            const { data } = await adminServ.getDistricts(stateId);
            setDistricts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load filter districts error:", err);
        }
    }, []);

    const loadFormDistricts = useCallback(async (stateId) => {
        if (!stateId) {
            setFormDistricts([]);
            return;
        }
        try {
            const { data } = await adminServ.getDistricts(stateId);
            setFormDistricts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load form districts error:", err);
        }
    }, []);

    useEffect(() => {
        loadUsers();
        loadStates();
        loadAllDistricts();
    }, [loadUsers, loadStates, loadAllDistricts]);

    useEffect(() => {
        loadFilterDistricts(stateFilter);
        setDistrictFilter("");
    }, [stateFilter, loadFilterDistricts]);

    useEffect(() => {
        setPage(0);
        setMobileVisible(MOBILE_BATCH);
    }, [search, roleFilter, stateFilter, districtFilter, statusFilter, dateFilter]);

    const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Admin";

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        const now = new Date();
        return users.filter((u) => {
            const name = userName(u).toLowerCase();
            const email = (u.email || "").toLowerCase();
            if (q && !name.includes(q) && !email.includes(q)) return false;
            if (roleFilter && u.role !== roleFilter) return false;
            if (stateFilter && u.stateId !== Number(stateFilter)) return false;
            if (districtFilter && u.districtId !== Number(districtFilter)) return false;
            if (statusFilter && u.status !== statusFilter) return false;
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
    }, [users, search, roleFilter, stateFilter, districtFilter, statusFilter, dateFilter]);

    const roles = useMemo(
        () => [...new Set(users.map((u) => u.role).filter(Boolean))],
        [users]
    );

    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter((u) => u.status === "Active").length;
        const inactive = users.filter((u) => u.status !== "Active").length;
        const owners = users.filter((u) => u.role === "OWNER").length;
        return { total, active, inactive, owners };
    }, [users]);

    const stateName = (sid) =>
        (states.find((s) => s.id === sid) || {}).name || "—";
    const districtName = (did) =>
        (allDistricts.find((d) => d.id === did) || {}).name || "—";

    const hasFilters = Boolean(
        search || roleFilter || stateFilter || districtFilter || statusFilter || dateFilter
    );

    const resetFilters = () => {
        setSearch("");
        setRoleFilter("");
        setStateFilter("");
        setDistrictFilter("");
        setStatusFilter("");
        if (dateFilter) navigate("/users");
    };

    const guard = (fn) => (event) => {
        event?.stopPropagation?.();
        fn();
    };

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setFormError("");
        setFormDistricts([]);
        setDrawerOpen(true);
    };

    const openEdit = (u) => {
        setEditing(u);
        setForm({
            firstName: u.firstName || "",
            lastName: u.lastName || "",
            email: u.email || "",
            password: "",
            currentPassword: "",
            role: u.role || "HR",
            stateId: u.stateId || "",
            districtId: u.districtId || "",
            status: u.status || "Active",
        });
        setFormErrors({});
        setFormError("");
        if (u.stateId) loadFormDistricts(u.stateId);
        else setFormDistricts([]);
        setDrawerOpen(true);
    };

    const openRole = (u) => {
        setRoleUser(u);
        setForm((prev) => ({ ...prev, role: u.role || "HR" }));
        setFormError("");
    };

    const openReset = (u) => {
        setResetUser(u);
        setForm((prev) => ({ ...prev, password: "", currentPassword: "" }));
        setFormError("");
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (name === "stateId") {
            setForm((prev) => ({ ...prev, districtId: "" }));
            loadFormDistricts(value);
        }
    };

    const validateForm = () => {
        const next = {};
        if (!String(form.firstName || "").trim()) next.firstName = true;
        if (!String(form.lastName || "").trim()) next.lastName = true;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email || "").trim())) next.email = true;
        if (!editing && String(form.password || "").length < 8) next.password = true;
        if (!form.role) next.role = true;

        setFormErrors(next);
        if (Object.keys(next).length > 0) {
            setFormError("Please fill all required fields correctly.");
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        setFormError("");
        try {
            const payload = {
                firstName: String(form.firstName).trim(),
                lastName: String(form.lastName).trim(),
                email: String(form.email).trim(),
                role: form.role,
                stateId: form.stateId ? Number(form.stateId) : null,
                districtId: form.districtId ? Number(form.districtId) : null,
                status: form.status,
            };

            if (editing) {
                await adminServ.updateUser(editing.id, payload);
                showToast("User updated successfully.");
            } else {
                await adminServ.createUser({ ...payload, password: form.password });
                showToast("User created successfully.");
            }

            setDrawerOpen(false);
            await loadUsers();
            setPage(0);
            setMobileVisible(MOBILE_BATCH);
        } catch (err) {
            setFormError(err.response?.data?.message || "Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    const handleStatusToggle = async (u) => {
        const target = u.status === "Active" ? "Inactive" : "Active";
        const endpoint = target === "Active" ? "activate" : "deactivate";
        try {
            await adminServ.toggleUser(u.id, endpoint);
            showToast(`User ${target.toLowerCase()} successfully.`);
            await loadUsers();
        } catch (err) {
            console.error("Status toggle error:", err);
            showToast("Failed to update status.", "error");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSaving(true);
        try {
            await adminServ.deleteUser(deleteTarget.id);
            setDeleteTarget(null);
            showToast("User deleted successfully.");
            await loadUsers();
        } catch (err) {
            console.error("Delete error:", err);
            showToast("Failed to delete user.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleRoleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");
        setSaving(true);
        try {
            await adminServ.assignRole(roleUser.id, form.role);
            setRoleUser(null);
            showToast("Role updated successfully.");
            await loadUsers();
        } catch (err) {
            setFormError(err.response?.data?.message || "Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    const handleResetSubmit = async (event) => {
        event.preventDefault();
        setFormError("");

        const isSelf = resetUser && user && resetUser.id === user.id;

        if (isSelf && !form.currentPassword) {
            setFormError("Current password is required.");
            return;
        }
        if (!form.password) {
            setFormError("New password is required.");
            return;
        }
        if (form.password.length < 8) {
            setFormError("New password must be at least 8 characters.");
            return;
        }
        if (isSelf && form.currentPassword === form.password) {
            setFormError("New password must be different from current password.");
            return;
        }

        setSaving(true);
        try {
            const body = isSelf
                ? { currentPassword: form.currentPassword, password: form.password }
                : { password: form.password };

            await adminServ.resetPassword(resetUser.id, body);
            setResetUser(null);
            showToast(isSelf ? "Password changed successfully." : "Password reset successfully.");
        } catch (err) {
            setFormError(err.response?.data?.message || "Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    const rowActions = (u) => {
        const actions = [
            {
                key: "view",
                label: "View user",
                ariaLabel: `View ${userName(u)}`,
                icon: VisibilityOutlined,
                onClick: guard(() => setViewUser(u)),
            },
        ];

        if (isAdmin) {
            actions.push({
                key: "edit",
                label: "Edit user",
                ariaLabel: `Edit ${userName(u)}`,
                icon: EditOutlined,
                onClick: guard(() => openEdit(u)),
            });
        }

        if (isOwner) {
            actions.push({
                key: "role",
                label: "Change role",
                ariaLabel: `Change role for ${userName(u)}`,
                icon: BadgeOutlined,
                onClick: guard(() => openRole(u)),
            });
        }

        if (isOwner || (user && u.id === user.id)) {
            actions.push({
                key: "reset",
                label: isOwner ? "Reset password" : "Change password",
                ariaLabel: isOwner ? `Reset password for ${userName(u)}` : "Change your password",
                icon: LockReset,
                onClick: guard(() => openReset(u)),
            });
        }

        if (isAdmin) {
            const active = u.status === "Active";
            actions.push({
                key: "toggle",
                label: active ? "Deactivate" : "Activate",
                ariaLabel: active ? `Deactivate ${userName(u)}` : `Activate ${userName(u)}`,
                icon: active ? Block : CheckCircle,
                onClick: guard(() => handleStatusToggle(u)),
            });
        }

        if (isOwner) {
            actions.push({
                key: "delete",
                label: "Delete",
                ariaLabel: `Delete ${userName(u)}`,
                icon: DeleteOutlineOutlined,
                tone: "danger",
                onClick: guard(() => setDeleteTarget(u)),
            });
        }

        return actions;
    };

    const columns = [
        {
            key: "member",
            header: "Member",
            render: (u) => (
                <span className="um-person">
                    <span className="um-avatar" aria-hidden="true">
                        {initialsOf(u)}
                    </span>
                    <span className="um-person-copy">
                        <span className="admin-cell-primary">{userName(u)}</span>
                        <span className="admin-cell-sub">{u.email || "No email"}</span>
                    </span>
                </span>
            ),
        },
        {
            key: "role",
            header: "Role",
            render: (u) => (
                <span className={`um-role-badge${u.role === "OWNER" ? " is-owner" : ""}`}>
                    {u.role || "—"}
                </span>
            ),
        },
        {
            key: "state",
            header: "State",
            render: (u) => u.state || stateName(u.stateId) || "—",
        },
        {
            key: "district",
            header: "District",
            render: (u) => u.district || districtName(u.districtId) || "—",
        },
        {
            key: "status",
            header: "Status",
            render: (u) => <StatusBadge status={u.status || "Active"} />,
        },
        {
            key: "lastLogin",
            header: "Last login",
            render: (u) => <span className="um-lastlogin">{formatLastLogin(u.lastLogin)}</span>,
        },
        {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (u) => <RowActions actions={rowActions(u)} />,
        },
    ];

    const emptyState = (
        <EmptyState
            icon={<GroupOutlined />}
            title={hasFilters ? "No users match these filters." : "No admin or HR users yet."}
            subtitle={
                hasFilters
                    ? "Try a different name, role, state or status."
                    : "Add the first admin or HR account to get started."
            }
            action={
                hasFilters ? (
                    <button type="button" className="admin-btn is-ghost-dark" onClick={resetFilters}>
                        Reset filters
                    </button>
                ) : isOwner ? (
                    <button type="button" className="admin-btn is-primary-solid" onClick={openAdd}>
                        New Admin / HR
                    </button>
                ) : null
            }
        />
    );

    const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pagedUsers = filteredUsers.slice(
        safePage * PAGE_SIZE,
        safePage * PAGE_SIZE + PAGE_SIZE
    );
    const mobileUsers = filteredUsers.slice(0, mobileVisible);

    const dateFilterLabel =
        dateFilter === "today"
            ? "Today's signups"
            : dateFilter === "week"
              ? "This week's signups"
              : dateFilter === "trend"
                ? "Last 7 days"
                : "";

    return (
        <div className="dash-page admin-page-shell">
            <Sidebar
                activeKey="users"
                onLogout={handleLogout}
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
            />

            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={user?.role || "Administrator"}
                    user={user}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed((c) => !c)}
                    onLogout={handleLogout}
                />

                <div className="dash-content">
                    <div className="admin-page">
                        <PageHeader
                            title="Admin & HR Users"
                            subtitle="Manage admin and HR accounts and their access"
                            actions={
                                isOwner
                                    ? [
                                          {
                                              key: "add",
                                              label: "New Admin / HR",
                                              icon: AddIcon,
                                              variant: "primary",
                                              onClick: openAdd,
                                          },
                                      ]
                                    : []
                            }
                        />

                        {dateFilter && (
                            <div className="um-filter-banner">
                                <span className="um-filter-banner-text">
                                    Showing: {dateFilterLabel} — {filteredUsers.length} user
                                    {filteredUsers.length === 1 ? "" : "s"} found
                                </span>
                                <button
                                    type="button"
                                    className="um-filter-banner-clear"
                                    onClick={resetFilters}
                                >
                                    Clear filter
                                </button>
                            </div>
                        )}

                        {error && (
                            <Alert
                                severity="error"
                                action={
                                    <button
                                        type="button"
                                        className="admin-btn is-ghost-dark"
                                        onClick={loadUsers}
                                    >
                                        Retry
                                    </button>
                                }
                            >
                                {error}
                            </Alert>
                        )}

                        <div className="admin-toolbar">
                            <div className="admin-toolbar-left">
                                <SearchInput
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Search by name or email..."
                                    ariaLabel="Search users"
                                />

                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <InputLabel id="um-role-filter">Role</InputLabel>
                                    <Select
                                        labelId="um-role-filter"
                                        label="Role"
                                        value={roleFilter}
                                        onChange={(event) => setRoleFilter(event.target.value)}
                                    >
                                        <MenuItem value="">All roles</MenuItem>
                                        {roles.map((role) => (
                                            <MenuItem key={role} value={role}>
                                                {role}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel id="um-state-filter">State</InputLabel>
                                    <Select
                                        labelId="um-state-filter"
                                        label="State"
                                        value={stateFilter}
                                        onChange={(event) => setStateFilter(event.target.value)}
                                    >
                                        <MenuItem value="">All states</MenuItem>
                                        {states.map((state) => (
                                            <MenuItem key={state.id} value={state.id}>
                                                {state.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel id="um-district-filter">District</InputLabel>
                                    <Select
                                        labelId="um-district-filter"
                                        label="District"
                                        value={districtFilter}
                                        disabled={!stateFilter}
                                        onChange={(event) => setDistrictFilter(event.target.value)}
                                    >
                                        <MenuItem value="">All districts</MenuItem>
                                        {districts.map((district) => (
                                            <MenuItem key={district.id} value={district.id}>
                                                {district.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </div>

                            <div className="admin-toolbar-right">
                                <FilterPills
                                    ariaLabel="Filter users by status"
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={[
                                        { key: "", label: "All", count: users.length },
                                        { key: "Active", label: "Active", count: stats.active },
                                        { key: "Inactive", label: "Inactive", count: stats.inactive },
                                    ]}
                                />
                            </div>
                        </div>

                        <DataTable
                            ariaLabel="Admin and HR users"
                            columns={columns}
                            rows={pagedUsers}
                            rowKey="id"
                            loading={loading}
                            skeletonRows={PAGE_SIZE}
                            empty={emptyState}
                            onRowClick={(u) => setViewUser(u)}
                        />

                        <Pagination
                            page={safePage}
                            pageSize={PAGE_SIZE}
                            total={filteredUsers.length}
                            onPageChange={setPage}
                        />

                        <MobileCardList
                            items={mobileUsers}
                            loading={loading}
                            getKey={(u) => u.id}
                            hasMore={filteredUsers.length > mobileVisible}
                            onLoadMore={() => setMobileVisible((prev) => prev + MOBILE_BATCH)}
                            empty={emptyState}
                            renderItem={(u) => (
                                <MobileCard
                                    title={userName(u)}
                                    subtitle={u.email || "No email"}
                                    badge={<StatusBadge status={u.status || "Active"} />}
                                    fields={[
                                        { label: "Role", value: u.role || "—" },
                                        { label: "State", value: u.state || stateName(u.stateId) },
                                        {
                                            label: "District",
                                            value: u.district || districtName(u.districtId),
                                        },
                                        {
                                            label: "Last login",
                                            value: formatLastLogin(u.lastLogin),
                                        },
                                    ]}
                                    actions={rowActions(u)}
                                    ariaLabel={`${userName(u)} account`}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>

            <FormDrawer
                open={drawerOpen}
                title={editing ? "Edit User" : "New Admin / HR"}
                submitLabel={editing ? "Save Changes" : "Create User"}
                saving={saving}
                error={formError}
                onClose={() => {
                    if (!saving) setDrawerOpen(false);
                }}
                onSubmit={handleSave}
            >
                <div className="admin-form">
                    <div className="admin-form-row">
                        <TextField
                            label="First name"
                            name="firstName"
                            value={form.firstName}
                            onChange={handleFormChange}
                            error={Boolean(formErrors.firstName)}
                            fullWidth
                            size="small"
                            autoFocus
                        />
                        <TextField
                            label="Last name"
                            name="lastName"
                            value={form.lastName}
                            onChange={handleFormChange}
                            error={Boolean(formErrors.lastName)}
                            fullWidth
                            size="small"
                        />
                    </div>

                    <TextField
                        label="Email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleFormChange}
                        error={Boolean(formErrors.email)}
                        fullWidth
                        size="small"
                    />

                    {!editing && (
                        <TextField
                            label="Password"
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={handleFormChange}
                            error={Boolean(formErrors.password)}
                            fullWidth
                            size="small"
                        />
                    )}

                    <div className="admin-form-row">
                        <FormControl fullWidth size="small">
                            <InputLabel id="um-form-role">Role</InputLabel>
                            <Select
                                labelId="um-form-role"
                                label="Role"
                                name="role"
                                value={form.role}
                                onChange={handleFormChange}
                            >
                                <MenuItem value="HR">HR</MenuItem>
                                <MenuItem value="OWNER">Owner</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                            <InputLabel id="um-form-status">Status</InputLabel>
                            <Select
                                labelId="um-form-status"
                                label="Status"
                                name="status"
                                value={form.status}
                                onChange={handleFormChange}
                            >
                                <MenuItem value="Active">Active</MenuItem>
                                <MenuItem value="Inactive">Inactive</MenuItem>
                            </Select>
                        </FormControl>
                    </div>

                    <div className="admin-form-row">
                        <FormControl fullWidth size="small">
                            <InputLabel id="um-form-state">State</InputLabel>
                            <Select
                                labelId="um-form-state"
                                label="State"
                                name="stateId"
                                value={form.stateId}
                                onChange={handleFormChange}
                            >
                                <MenuItem value="">Select state</MenuItem>
                                {states.map((state) => (
                                    <MenuItem key={state.id} value={state.id}>
                                        {state.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                            <InputLabel id="um-form-district">District</InputLabel>
                            <Select
                                labelId="um-form-district"
                                label="District"
                                name="districtId"
                                value={form.districtId}
                                disabled={!form.stateId}
                                onChange={handleFormChange}
                            >
                                <MenuItem value="">Select district</MenuItem>
                                {formDistricts.map((district) => (
                                    <MenuItem key={district.id} value={district.id}>
                                        {district.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>
                </div>
            </FormDrawer>

            <Dialog
                open={Boolean(viewUser)}
                onClose={() => setViewUser(null)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: "18px", overflow: "hidden" } }}
            >
                {viewUser && (
                    <div className="um-view-head">
                        <span className="um-avatar um-avatar-lg" aria-hidden="true">
                            {initialsOf(viewUser)}
                        </span>
                        <div className="um-view-copy">
                            <h2>{userName(viewUser)}</h2>
                            <p>{viewUser.email || "No email"}</p>
                        </div>
                        <button
                            type="button"
                            className="admin-icon-btn"
                            aria-label="Close user details"
                            onClick={() => setViewUser(null)}
                        >
                            <CloseRounded fontSize="small" />
                        </button>
                    </div>
                )}
                <DialogContent sx={{ p: { xs: 2, sm: 3 }, bgcolor: "#f8f9fc" }}>
                    {viewUser && (
                        <div className="um-view-grid">
                            <div>
                                <span>Role</span>
                                <strong className={`um-role-badge${viewUser.role === "OWNER" ? " is-owner" : ""}`}>
                                    {viewUser.role || "—"}
                                </strong>
                            </div>
                            <div>
                                <span>Status</span>
                                <strong>
                                    <StatusBadge status={viewUser.status || "Active"} />
                                </strong>
                            </div>
                            <div>
                                <span>State</span>
                                <strong>{viewUser.state || stateName(viewUser.stateId)}</strong>
                            </div>
                            <div>
                                <span>District</span>
                                <strong>{viewUser.district || districtName(viewUser.districtId)}</strong>
                            </div>
                            <div>
                                <span>Last login</span>
                                <strong>{formatLastLogin(viewUser.lastLogin)}</strong>
                            </div>
                            <div>
                                <span>User ID</span>
                                <strong>#{viewUser.id}</strong>
                            </div>
                        </div>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, bgcolor: "#f8f9fc" }}>
                    <button
                        type="button"
                        className="admin-btn is-ghost-dark"
                        onClick={() => setViewUser(null)}
                    >
                        Close
                    </button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(roleUser)}
                onClose={() => setRoleUser(null)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: "18px" } }}
            >
                <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>Change Role</DialogTitle>
                <form onSubmit={handleRoleSubmit}>
                    <DialogContent>
                        {formError && (
                            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                                {formError}
                            </Alert>
                        )}
                        <p className="um-dialog-note">
                            Changing role for <strong>{roleUser ? userName(roleUser) : ""}</strong>
                        </p>
                        <FormControl fullWidth size="small">
                            <InputLabel id="um-dialog-role">Role</InputLabel>
                            <Select
                                labelId="um-dialog-role"
                                label="Role"
                                name="role"
                                value={form.role}
                                onChange={handleFormChange}
                            >
                                <MenuItem value="HR">HR</MenuItem>
                                <MenuItem value="OWNER">Owner</MenuItem>
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                        <button
                            type="button"
                            className="admin-btn is-ghost-dark"
                            onClick={() => setRoleUser(null)}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="admin-btn is-primary-solid" disabled={saving}>
                            {saving ? "Updating…" : "Update Role"}
                        </button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog
                open={Boolean(resetUser)}
                onClose={() => setResetUser(null)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: "18px" } }}
            >
                <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>
                    {resetUser && user && resetUser.id === user.id ? "Change Password" : "Reset Password"}
                </DialogTitle>
                <form onSubmit={handleResetSubmit}>
                    <DialogContent>
                        {formError && (
                            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                                {formError}
                            </Alert>
                        )}
                        {resetUser && user && resetUser.id === user.id ? (
                            <p className="um-dialog-note">
                                Enter your current password, then choose a new one.
                            </p>
                        ) : (
                            <p className="um-dialog-note">
                                Set a new password for <strong>{resetUser ? userName(resetUser) : ""}</strong>
                            </p>
                        )}
                        {resetUser && user && resetUser.id === user.id && (
                            <TextField
                                label="Current password"
                                name="currentPassword"
                                type="password"
                                value={form.currentPassword}
                                onChange={handleFormChange}
                                fullWidth
                                size="small"
                                sx={{ mb: 2 }}
                            />
                        )}
                        <TextField
                            label="New password"
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={handleFormChange}
                            fullWidth
                            size="small"
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                        <button
                            type="button"
                            className="admin-btn is-ghost-dark"
                            onClick={() => setResetUser(null)}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="admin-btn is-primary-solid" disabled={saving}>
                            {saving ? "Saving…" : resetUser && user && resetUser.id === user.id ? "Change Password" : "Reset Password"}
                        </button>
                    </DialogActions>
                </form>
            </Dialog>

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title="Delete user"
                message="Ye wapas nahi hoga."
                confirmLabel="Delete"
                loading={saving}
                onConfirm={handleDelete}
                onClose={() => setDeleteTarget(null)}
            />

            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setToast((t) => ({ ...t, open: false }))}
                    severity={toast.type}
                    sx={{ width: "100%", borderRadius: 2.5 }}
                >
                    {toast.text}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default UserManagement;
