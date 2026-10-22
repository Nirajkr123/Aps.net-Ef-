import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    IconButton,
    DialogContentText,
} from "@mui/material";
import {
    Add,
    Close,
    DeleteOutlined,
    EditOutlined,
    LocationCity,
    Place,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import adminServ from "../services/adminService";

import "./AdminDashboard.css";
import "./ManageLocations.css";

function ManageLocations() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [selectedStateId, setSelectedStateId] = useState(null);

    // State dialog
    const [stateDialog, setStateDialog] = useState({ open: false, editing: null, name: "", error: "" });
    // District dialog
    const [districtDialog, setDistrictDialog] = useState({ open: false, editing: null, name: "", error: "" });
    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState({ open: false, type: "", id: null, name: "" });

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ text: "", open: false });

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
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
        setLoading(true);
        setError("");
        try {
            const { data } = await adminServ.getStates();
            setStates(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load states error:", err);
            setError("Could not load states.");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadDistricts = useCallback(async (stateId) => {
        if (!stateId) {
            setDistricts([]);
            return;
        }
        try {
            const { data } = await adminServ.getDistricts(stateId);
            setDistricts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load districts error:", err);
        }
    }, []);

    useEffect(() => {
        loadStates();
    }, [loadStates]);

    useEffect(() => {
        loadDistricts(selectedStateId);
    }, [selectedStateId, loadDistricts]);

    const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Admin";

    const selectedState = states.find((s) => s.id === selectedStateId) || null;

    // ---- States ----

    const openAddState = () =>
        setStateDialog({ open: true, editing: null, name: "", error: "" });

    const openEditState = (s) =>
        setStateDialog({ open: true, editing: s, name: s.name, error: "" });

    const saveState = async (e) => {
        e.preventDefault();
        const { editing, name } = stateDialog;
        if (!name.trim()) {
            setStateDialog((d) => ({ ...d, error: "State name is required" }));
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await adminServ.updateState(editing.id, { name: name.trim() });
            } else {
                await adminServ.createState({ name: name.trim() });
            }
            setStateDialog((d) => ({ ...d, open: false }));
            showToast(editing ? "State updated successfully!" : "State created successfully!");
            await loadStates();
        } catch (err) {
            console.error("Save state error:", err);
            setStateDialog((d) => ({ ...d, error: "Could not reach the server." }));
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteState = (s) =>
        setDeleteTarget({ open: true, type: "state", id: s.id, name: s.name });

    const deleteState = async () => {
        const { id } = deleteTarget;
        setSaving(true);
        try {
            await adminServ.deleteState(id);
            setDeleteTarget((d) => ({ ...d, open: false }));
            if (selectedStateId === id) {
                setSelectedStateId(null);
            }
            showToast("State deleted successfully!");
            await loadStates();
        } catch (err) {
            console.error("Delete state error:", err);
            setDeleteTarget((d) => ({ ...d, open: false }));
            showToast("Failed to delete state.");
        } finally {
            setSaving(false);
        }
    };

    // ---- Districts ----

    const openAddDistrict = () =>
        setDistrictDialog({ open: true, editing: null, name: "", error: "" });

    const openEditDistrict = (d) =>
        setDistrictDialog({ open: true, editing: d, name: d.name, error: "" });

    const saveDistrict = async (e) => {
        e.preventDefault();
        const { editing, name } = districtDialog;
        if (!name.trim()) {
            setDistrictDialog((d) => ({ ...d, error: "District name is required" }));
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await adminServ.updateDistrict(editing.id, { name: name.trim(), stateId: selectedStateId });
            } else {
                await adminServ.createDistrict({ name: name.trim(), stateId: selectedStateId });
            }
            setDistrictDialog((d) => ({ ...d, open: false }));
            showToast(editing ? "District updated successfully!" : "District created successfully!");
            await loadDistricts(selectedStateId);
        } catch (err) {
            console.error("Save district error:", err);
            setDistrictDialog((d) => ({ ...d, error: "Could not reach the server." }));
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteDistrict = (d) =>
        setDeleteTarget({ open: true, type: "district", id: d.id, name: d.name });

    const deleteDistrict = async () => {
        const { id } = deleteTarget;
        setSaving(true);
        try {
            await adminServ.deleteDistrict(id);
            setDeleteTarget((d) => ({ ...d, open: false }));
            showToast("District deleted successfully!");
            await loadDistricts(selectedStateId);
        } catch (err) {
            console.error("Delete district error:", err);
            setDeleteTarget((d) => ({ ...d, open: false }));
            showToast("Failed to delete district.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="dash-page">
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
                    searchPlaceholder="Manage locations..."
                    onLogout={handleLogout}
                    onNavigate={(key) => {
                        if (key === "settings") navigate("/settings");
                    }}
                />

                <div className="dash-content">
                    <div className="dash-header">
                        <div>
                            <h1 className="dash-title">Manage Locations</h1>
                            <p className="dash-subtitle">
                                Manage states and their districts
                            </p>
                        </div>
                        <div className="dash-header-actions">
                            <button type="button" className="dash-btn dash-btn-ghost" onClick={() => navigate("/users")}>
                                Back to Users
                            </button>
                        </div>
                    </div>

                    {loading && (
                        <div className="dash-loading">
                            <CircularProgress size={32} />
                            <p className="dash-loading-text">Loading locations...</p>
                        </div>
                    )}

                    {error && !loading && <div className="dash-error">{error}</div>}

                    {!loading && !error && (
                        <>
                            {/* CREATE LOCATION SECTION */}
                            <div className="loc-create-section">
                                <div className="loc-create-card" onClick={openAddState}>
                                    <div className="loc-create-icon loc-create-icon-violet">
                                        <Place fontSize="inherit" />
                                    </div>
                                    <div className="loc-create-info">
                                        <p className="loc-create-title">Create State</p>
                                        <p className="loc-create-sub">Add a new state to the system</p>
                                    </div>
                                    <span className="loc-create-arrow">
                                        <Add fontSize="small" />
                                    </span>
                                </div>
                                <div
                                    className={`loc-create-card ${!selectedStateId ? "loc-create-disabled" : ""}`}
                                    onClick={() => { if (selectedStateId) openAddDistrict(); }}
                                >
                                    <div className="loc-create-icon loc-create-icon-blue">
                                        <LocationCity fontSize="inherit" />
                                    </div>
                                    <div className="loc-create-info">
                                        <p className="loc-create-title">Create District</p>
                                        <p className="loc-create-sub">
                                            {selectedStateId
                                                ? `Add district to ${selectedState?.name || "selected state"}`
                                                : "Select a state first"}
                                        </p>
                                    </div>
                                    <span className="loc-create-arrow">
                                        <Add fontSize="small" />
                                    </span>
                                </div>
                            </div>

                        <div className="loc-grid">
                            {/* STATES PANEL */}
                            <div className="loc-panel">
                                <div className="loc-panel-head">
                                    <div className="loc-panel-title">
                                        <span className="loc-panel-icon">
                                            <Place fontSize="inherit" />
                                        </span>
                                        <div>
                                            <p className="loc-panel-heading">States</p>
                                            <p className="loc-panel-sub">{states.length} total</p>
                                        </div>
                                    </div>
                                    <IconButton className="loc-add-btn" onClick={openAddState} aria-label="Add state">
                                        <Add fontSize="small" />
                                    </IconButton>
                                </div>
                                <div className="loc-list">
                                    {states.length === 0 && (
                                        <p className="loc-empty">No states yet.</p>
                                    )}
                                    {states.map((s) => (
                                        <div
                                            key={s.id}
                                            className={`loc-item ${s.id === selectedStateId ? "active" : ""}`}
                                            onClick={() => setSelectedStateId(s.id)}
                                        >
                                            <span className="loc-item-badge">{s.name.charAt(0)}</span>
                                            <span className="loc-item-name">{s.name}</span>
                                            <div className="loc-item-actions">
                                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditState(s); }} aria-label="Edit">
                                                    <EditOutlined fontSize="small" />
                                                </IconButton>
                                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); confirmDeleteState(s); }} aria-label="Delete" className="danger">
                                                    <DeleteOutlined fontSize="small" />
                                                </IconButton>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* DISTRICTS PANEL */}
                            <div className="loc-panel">
                                <div className="loc-panel-head">
                                    <div className="loc-panel-title">
                                        <span className="loc-panel-icon">
                                            <LocationCity fontSize="inherit" />
                                        </span>
                                        <div>
                                            <p className="loc-panel-heading">
                                                {selectedState ? `${selectedState.name} districts` : "Districts"}
                                            </p>
                                            <p className="loc-panel-sub">
                                                {selectedState ? `${districts.length} total` : "Select a state"}
                                            </p>
                                        </div>
                                    </div>
                                    <IconButton
                                        className="loc-add-btn"
                                        onClick={openAddDistrict}
                                        disabled={!selectedStateId}
                                        aria-label="Add district"
                                    >
                                        <Add fontSize="small" />
                                    </IconButton>
                                </div>
                                <div className="loc-list">
                                    {!selectedState ? (
                                        <p className="loc-empty">Click a state to view its districts.</p>
                                    ) : districts.length === 0 ? (
                                        <p className="loc-empty">No districts in this state yet.</p>
                                    ) : (
                                        districts.map((d) => (
                                            <div key={d.id} className="loc-item">
                                                <span className="loc-item-badge">{d.name.charAt(0)}</span>
                                                <span className="loc-item-name">{d.name}</span>
                                                <div className="loc-item-actions">
                                                    <IconButton size="small" onClick={() => openEditDistrict(d)} aria-label="Edit">
                                                        <EditOutlined fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => confirmDeleteDistrict(d)} aria-label="Delete" className="danger">
                                                    <DeleteOutlined fontSize="small" />
                                                    </IconButton>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        </>
                    )}
                </div>
            </div>

            {/* STATE DIALOG */}
            <Dialog open={stateDialog.open} onClose={() => setStateDialog((d) => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
                <DialogTitle className="modal-title">
                    {stateDialog.editing ? "Edit State" : "Add State"}
                    <IconButton className="modal-close" onClick={() => setStateDialog((d) => ({ ...d, open: false }))} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <form onSubmit={saveState}>
                    <DialogContent className="modal-body">
                        {stateDialog.error && <div className="modal-error">{stateDialog.error}</div>}
                        <TextField
                            label="State Name"
                            fullWidth
                            value={stateDialog.name}
                            onChange={(e) => setStateDialog((d) => ({ ...d, name: e.target.value, error: "" }))}
                            autoFocus
                        />
                    </DialogContent>
                    <DialogActions className="modal-actions">
                        <Button onClick={() => setStateDialog((d) => ({ ...d, open: false }))} className="modal-btn-cancel">Cancel</Button>
                        <Button type="submit" variant="contained" disabled={saving} className="modal-btn-submit">
                            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : (stateDialog.editing ? "Save" : "Add")}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* DISTRICT DIALOG */}
            <Dialog open={districtDialog.open} onClose={() => setDistrictDialog((d) => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
                <DialogTitle className="modal-title">
                    {districtDialog.editing ? "Edit District" : "Add District"}
                    <IconButton className="modal-close" onClick={() => setDistrictDialog((d) => ({ ...d, open: false }))} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <form onSubmit={saveDistrict}>
                    <DialogContent className="modal-body">
                        {districtDialog.error && <div className="modal-error">{districtDialog.error}</div>}
                        <p className="confirm-text" style={{ color: "#6b7280" }}>
                            State: <strong>{selectedState ? selectedState.name : ""}</strong>
                        </p>
                        <TextField
                            label="District Name"
                            fullWidth
                            value={districtDialog.name}
                            onChange={(e) => setDistrictDialog((d) => ({ ...d, name: e.target.value, error: "" }))}
                            autoFocus
                        />
                    </DialogContent>
                    <DialogActions className="modal-actions">
                        <Button onClick={() => setDistrictDialog((d) => ({ ...d, open: false }))} className="modal-btn-cancel">Cancel</Button>
                        <Button type="submit" variant="contained" disabled={saving} className="modal-btn-submit">
                            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : (districtDialog.editing ? "Save" : "Add")}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* DELETE CONFIRM */}
            <Dialog open={deleteTarget.open} onClose={() => setDeleteTarget((d) => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
                <DialogTitle className="modal-title confirm-title">
                    Delete {deleteTarget.type === "state" ? "State" : "District"}
                    <IconButton className="modal-close" onClick={() => setDeleteTarget((d) => ({ ...d, open: false }))} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent className="modal-body">
                    <DialogContentText>
                        Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions className="modal-actions">
                    <Button onClick={() => setDeleteTarget((d) => ({ ...d, open: false }))} className="modal-btn-cancel">Cancel</Button>
                    <Button onClick={deleteTarget.type === "state" ? deleteState : deleteDistrict} className="modal-btn-danger">
                        {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>

            <div className="loc-toast" style={{ display: toast.open ? "flex" : "none" }}>
                {toast.text}
            </div>
        </div>
    );
}

export default ManageLocations;
