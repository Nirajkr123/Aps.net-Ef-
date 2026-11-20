import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Skeleton, Snackbar, TextField } from "@mui/material";
import {
    Add as AddIcon,
    ArrowBackRounded,
    DeleteOutlineOutlined,
    EditOutlined,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import adminServ from "../services/adminService";

import "./AdminDashboard.css";
import "./ManageLocations.css";

import {
    ConfirmModal,
    CountBadge,
    FormDrawer,
    PageHeader,
    RowActions,
} from "../components/admin";

function ManageLocations() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [districtsLoading, setDistrictsLoading] = useState(false);
    const [error, setError] = useState("");

    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [allDistricts, setAllDistricts] = useState([]);
    const [selectedStateId, setSelectedStateId] = useState(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerType, setDrawerType] = useState("state");
    const [editing, setEditing] = useState(null);
    const [name, setName] = useState("");
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [toast, setToast] = useState({ text: "", open: false });

    useEffect(() => {
        try {
            setUser(JSON.parse(localStorage.getItem("user") || "null"));
        } catch {
            setUser(null);
        }
    }, []);

    const showToast = (text) => setToast({ text, open: true });

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const loadStates = useCallback(async () => {
        setError("");
        try {
            const { data } = await adminServ.getStates();
            setStates(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load states error:", err);
            setError("Could not load locations. Please check the server and try again.");
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

    const loadDistricts = useCallback(async (stateId) => {
        if (!stateId) {
            setDistricts([]);
            return;
        }
        setDistrictsLoading(true);
        try {
            const { data } = await adminServ.getDistricts(stateId);
            setDistricts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load state districts error:", err);
            setDistricts([]);
        } finally {
            setDistrictsLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([loadStates(), loadAllDistricts()]).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [loadStates, loadAllDistricts]);

    useEffect(() => {
        loadDistricts(selectedStateId);
    }, [selectedStateId, loadDistricts]);

    const handleRefresh = async () => {
        setLoading(true);
        await Promise.all([loadStates(), loadAllDistricts(), loadDistricts(selectedStateId)]);
        setLoading(false);
    };

    const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Admin";

    const selectedState = useMemo(
        () => states.find((state) => state.id === selectedStateId) || null,
        [states, selectedStateId]
    );

    const districtCountFor = (stateId) =>
        allDistricts.filter((district) => district.stateId === stateId).length;

    const guard = (fn) => (event) => {
        event?.stopPropagation?.();
        fn();
    };

    const openCreate = (type) => {
        if (type === "district" && !selectedStateId) return;
        setDrawerType(type);
        setEditing(null);
        setName("");
        setFormError("");
        setDrawerOpen(true);
    };

    const openEdit = (type, item) => {
        setDrawerType(type);
        setEditing(item);
        setName(item.name || "");
        setFormError("");
        setDrawerOpen(true);
    };

    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setFormError("Name is required.");
            return;
        }

        setSaving(true);
        setFormError("");
        try {
            if (drawerType === "state") {
                if (editing) {
                    await adminServ.updateState(editing.id, { name: trimmed });
                    showToast("State updated successfully.");
                } else {
                    await adminServ.createState({ name: trimmed });
                    showToast("State created successfully.");
                }
            } else if (editing) {
                await adminServ.updateDistrict(editing.id, {
                    name: trimmed,
                    stateId: selectedStateId,
                });
                showToast("District updated successfully.");
            } else {
                await adminServ.createDistrict({
                    name: trimmed,
                    stateId: selectedStateId,
                });
                showToast("District created successfully.");
            }

            setDrawerOpen(false);
            await Promise.all([loadStates(), loadAllDistricts()]);
            if (drawerType === "district") await loadDistricts(selectedStateId);
        } catch (err) {
            console.error("Save location error:", err);
            setFormError("Could not reach the server.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSaving(true);
        try {
            if (deleteTarget.type === "state") {
                await adminServ.deleteState(deleteTarget.id);
                if (selectedStateId === deleteTarget.id) setSelectedStateId(null);
                showToast("State deleted successfully.");
            } else {
                await adminServ.deleteDistrict(deleteTarget.id);
                showToast("District deleted successfully.");
            }
            setDeleteTarget(null);
            await Promise.all([loadStates(), loadAllDistricts()]);
            if (deleteTarget.type === "district") await loadDistricts(selectedStateId);
        } catch (err) {
            console.error("Delete location error:", err);
            setDeleteTarget(null);
            showToast("Failed to delete. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const stateActions = (state) => [
        {
            key: "edit",
            label: "Edit state",
            ariaLabel: `Edit ${state.name}`,
            icon: EditOutlined,
            onClick: guard(() => openEdit("state", state)),
        },
        {
            key: "delete",
            label: "Delete state",
            ariaLabel: `Delete ${state.name}`,
            icon: DeleteOutlineOutlined,
            tone: "danger",
            onClick: guard(() =>
                setDeleteTarget({ type: "state", id: state.id, name: state.name })
            ),
        },
    ];

    const districtActions = (district) => [
        {
            key: "edit",
            label: "Edit district",
            ariaLabel: `Edit ${district.name}`,
            icon: EditOutlined,
            onClick: guard(() => openEdit("district", district)),
        },
        {
            key: "delete",
            label: "Delete district",
            ariaLabel: `Delete ${district.name}`,
            icon: DeleteOutlineOutlined,
            tone: "danger",
            onClick: guard(() =>
                setDeleteTarget({ type: "district", id: district.id, name: district.name })
            ),
        },
    ];

    const skeletonRows = (count) =>
        Array.from({ length: count }).map((_, index) => (
            <div className="loc-row" key={`loc-skeleton-${index}`} aria-hidden="true">
                <Skeleton variant="circular" width={34} height={34} />
                <div className="loc-row-copy">
                    <Skeleton variant="text" width="45%" height={18} />
                    <Skeleton variant="text" width="30%" height={13} />
                </div>
            </div>
        ));

    return (
        <div className="dash-page admin-page-shell">
            <Sidebar
                activeKey="locations"
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
                            title="Locations"
                            subtitle="Manage states and their districts"
                            actions={[
                                {
                                    key: "back",
                                    label: "Back to Users",
                                    icon: ArrowBackRounded,
                                    variant: "ghost",
                                    onClick: () => navigate("/users"),
                                },
                                {
                                    key: "add-state",
                                    label: "New State",
                                    icon: AddIcon,
                                    variant: "primary",
                                    onClick: () => openCreate("state"),
                                },
                            ]}
                        />

                        {error && (
                            <Alert
                                severity="error"
                                action={
                                    <button
                                        type="button"
                                        className="admin-btn is-ghost-dark"
                                        onClick={handleRefresh}
                                    >
                                        Retry
                                    </button>
                                }
                            >
                                {error}
                            </Alert>
                        )}

                        <div className="loc-grid">
                            <section className="loc-panel" aria-label="States">
                                <header className="loc-panel-head">
                                    <div>
                                        <div className="loc-panel-title">
                                            <span>States</span>
                                            <CountBadge value={states.length} />
                                        </div>
                                        <p className="loc-panel-sub">
                                            Select a state to manage its districts
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="admin-icon-btn"
                                        aria-label="Add state"
                                        onClick={() => openCreate("state")}
                                    >
                                        <AddIcon fontSize="small" />
                                    </button>
                                </header>

                                <div className="loc-list">
                                    {loading ? (
                                        skeletonRows(5)
                                    ) : states.length === 0 ? (
                                        <div className="loc-empty">No states yet.</div>
                                    ) : (
                                        states.map((state) => (
                                            <div
                                                key={state.id}
                                                className={`loc-row${
                                                    state.id === selectedStateId ? " is-active" : ""
                                                }`}
                                                role="button"
                                                tabIndex={0}
                                                aria-pressed={state.id === selectedStateId}
                                                onClick={() => setSelectedStateId(state.id)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        setSelectedStateId(state.id);
                                                    }
                                                }}
                                            >
                                                <span className="loc-badge" aria-hidden="true">
                                                    {String(state.name || "?").charAt(0).toUpperCase()}
                                                </span>
                                                <span className="loc-row-copy">
                                                    <span className="admin-cell-primary">
                                                        {state.name}
                                                    </span>
                                                    <span className="admin-cell-sub">
                                                        {districtCountFor(state.id)}{" "}
                                                        {districtCountFor(state.id) === 1
                                                            ? "district"
                                                            : "districts"}
                                                    </span>
                                                </span>
                                                <RowActions actions={stateActions(state)} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            <section className="loc-panel" aria-label="Districts">
                                <header className="loc-panel-head">
                                    <div>
                                        <div className="loc-panel-title">
                                            <span>
                                                {selectedState
                                                    ? `${selectedState.name} districts`
                                                    : "Districts"}
                                            </span>
                                            <CountBadge value={districts.length} />
                                        </div>
                                        <p className="loc-panel-sub">
                                            {selectedState
                                                ? "Manage districts in this state"
                                                : "Select a state first"}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="admin-icon-btn"
                                        aria-label="Add district"
                                        onClick={() => openCreate("district")}
                                        disabled={!selectedStateId}
                                    >
                                        <AddIcon fontSize="small" />
                                    </button>
                                </header>

                                <div className="loc-list">
                                    {!selectedStateId ? (
                                        <div className="loc-empty">
                                            Click a state to view its districts.
                                        </div>
                                    ) : districtsLoading ? (
                                        skeletonRows(4)
                                    ) : districts.length === 0 ? (
                                        <div className="loc-empty">
                                            No districts in this state yet.
                                        </div>
                                    ) : (
                                        districts.map((district) => (
                                            <div className="loc-row" key={district.id}>
                                                <span className="loc-badge" aria-hidden="true">
                                                    {String(district.name || "?")
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </span>
                                                <span className="loc-row-copy">
                                                    <span className="admin-cell-primary">
                                                        {district.name}
                                                    </span>
                                                    <span className="admin-cell-sub">
                                                        {selectedState?.name || "—"}
                                                    </span>
                                                </span>
                                                <RowActions actions={districtActions(district)} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            <FormDrawer
                open={drawerOpen}
                title={
                    editing
                        ? `Edit ${drawerType === "state" ? "State" : "District"}`
                        : `New ${drawerType === "state" ? "State" : "District"}`
                }
                submitLabel={editing ? "Save Changes" : "Create"}
                saving={saving}
                error={formError}
                onClose={() => {
                    if (!saving) setDrawerOpen(false);
                }}
                onSubmit={handleSave}
            >
                <div className="admin-form">
                    {drawerType === "district" && (
                        <Alert severity="info" sx={{ borderRadius: "12px" }}>
                            State: <strong>{selectedState?.name || "—"}</strong>
                        </Alert>
                    )}
                    <TextField
                        label={drawerType === "state" ? "State name" : "District name"}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        fullWidth
                        size="small"
                        autoFocus
                    />
                </div>
            </FormDrawer>

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title={`Delete ${deleteTarget?.type === "state" ? "state" : "district"}`}
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
                    severity="success"
                    sx={{ width: "100%", borderRadius: 2.5 }}
                >
                    {toast.text}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default ManageLocations;
