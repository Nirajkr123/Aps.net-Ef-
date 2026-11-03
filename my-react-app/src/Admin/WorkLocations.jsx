import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Snackbar,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import {
    AddLocationAlt,
    Close,
    EditOutlined,
    MyLocation,
    PlaceOutlined,
    Refresh,
} from "@mui/icons-material";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import adminServ from "../services/adminService";

import "./AdminDashboard.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [22.8046, 86.2029];
const DEFAULT_ZOOM = 13;

const blankForm = {
    name: "",
    latitude: DEFAULT_CENTER[0],
    longitude: DEFAULT_CENTER[1],
    radiusMeters: 100,
};

function FitLocations({ locations }) {
    const map = useMap();

    useEffect(() => {
        if (!locations.length) return;
        if (locations.length === 1) {
            map.setView([locations[0].latitude, locations[0].longitude], 15);
            return;
        }
        const bounds = L.latLngBounds(
            locations.map((location) => [location.latitude, location.longitude])
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }, [locations, map]);

    return null;
}

function LocationPicker({ latitude, longitude, radiusMeters, onChange }) {
    const map = useMapEvents({
        click(event) {
            onChange(event.latlng.lat, event.latlng.lng);
        },
    });

    useEffect(() => {
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.5 });
    }, [latitude, longitude, map]);

    return (
        <>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Circle
                center={[latitude, longitude]}
                radius={Number(radiusMeters) || 100}
                pathOptions={{ color: "#4f46e5", fillColor: "#6366f1", fillOpacity: 0.18 }}
            />
            <Marker
                position={[latitude, longitude]}
                draggable
                eventHandlers={{
                    dragend(event) {
                        const point = event.target.getLatLng();
                        onChange(point.lat, point.lng);
                    },
                }}
            >
                <Popup>Drag this marker or click the map to set the work location.</Popup>
            </Marker>
        </>
    );
}

function WorkLocations() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(blankForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [locating, setLocating] = useState(false);
    const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
    const mapRef = useRef(null);

    useEffect(() => {
        try {
            setUser(JSON.parse(localStorage.getItem("user") || "null"));
        } catch {
            setUser(null);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const loadLocations = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const { data } = await adminServ.getWorkLocations();
            setLocations(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Load work locations error:", err);
            setError("Could not load work locations. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLocations();
    }, [loadLocations]);

    const showToast = (message, severity = "success") =>
        setToast({ open: true, message, severity });

    const updatePoint = (latitude, longitude) =>
        setForm((current) => ({ ...current, latitude, longitude }));

    const openCreate = () => {
        const first = locations[0];
        setEditing(null);
        setForm({
            ...blankForm,
            latitude: first?.latitude ?? DEFAULT_CENTER[0],
            longitude: first?.longitude ?? DEFAULT_CENTER[1],
        });
        setFormError("");
        setDialogOpen(true);
        setTimeout(() => mapRef.current?.invalidateSize(), 150);
    };

    const openEdit = (location) => {
        setEditing(location);
        setForm({
            name: location.name || "",
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            radiusMeters: Number(location.radiusMeters) || 100,
        });
        setFormError("");
        setDialogOpen(true);
        setTimeout(() => mapRef.current?.invalidateSize(), 150);
    };

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            setFormError("Your browser does not support location access.");
            return;
        }

        setLocating(true);
        setFormError("");
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                setForm((current) => ({
                    ...current,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                }));
                setLocating(false);
            },
            () => {
                setFormError("Could not get your current location. Please allow location access.");
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const saveLocation = async (event) => {
        event.preventDefault();
        const name = form.name.trim();
        const latitude = Number(form.latitude);
        const longitude = Number(form.longitude);
        const radiusMeters = Number(form.radiusMeters);

        if (!name) {
            setFormError("Work location name is required.");
            return;
        }
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
            setFormError("Choose a valid latitude between -90 and 90.");
            return;
        }
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            setFormError("Choose a valid longitude between -180 and 180.");
            return;
        }
        if (!Number.isInteger(radiusMeters) || radiusMeters < 1 || radiusMeters > 10000) {
            setFormError("Radius must be a whole number between 1 and 10000 meters.");
            return;
        }

        setSaving(true);
        setFormError("");
        const payload = { name, latitude, longitude, radiusMeters };

        try {
            if (editing) {
                await adminServ.updateWorkLocation(editing.id, payload);
                showToast("Work location updated.");
            } else {
                await adminServ.createWorkLocation(payload);
                showToast("Work location added.");
            }
            setDialogOpen(false);
            await loadLocations();
        } catch (err) {
            console.error("Save work location error:", err);
            setFormError(err.response?.data?.message || "Could not save this work location.");
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (location, isActive) => {
        try {
            await adminServ.setWorkLocationActive(location.id, isActive);
            setLocations((current) =>
                current.map((item) => (item.id === location.id ? { ...item, isActive } : item))
            );
            showToast(isActive ? "Work location activated." : "Work location deactivated.");
        } catch (err) {
            console.error("Toggle work location error:", err);
            showToast(err.response?.data?.message || "Could not update this work location.", "error");
        }
    };

    const activeCount = locations.filter((location) => location.isActive).length;

    return (
        <div className="dash-page">
            <Sidebar
                activeKey="work-locations"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed(!collapsed)}
            />
            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin"}
                    userRole={user?.role || "OWNER"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed(!collapsed)}
                />
                <div className="dash-content">
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: { xs: "flex-start", sm: "center" },
                            justifyContent: "space-between",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 2,
                            mb: 3,
                        }}
                    >
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: "#171b2e" }}>
                                Work Locations
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#6b7280", mt: 0.5 }}>
                                Attendance is allowed only inside these geofence ranges.
                            </Typography>
                        </Box>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Button
                                variant="outlined"
                                startIcon={<Refresh />}
                                onClick={loadLocations}
                                disabled={loading}
                                sx={{ textTransform: "none" }}
                            >
                                Refresh
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<AddLocationAlt />}
                                onClick={openCreate}
                                sx={{ textTransform: "none", bgcolor: "#4f46e5" }}
                            >
                                Add Location
                            </Button>
                        </Box>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(320px, 0.65fr)" },
                            gap: 2.5,
                            alignItems: "start",
                        }}
                    >
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, overflow: "hidden" }}>
                            <Box sx={{ height: { xs: 330, md: 470 }, borderRadius: 2, overflow: "hidden" }}>
                                <MapContainer
                                    center={DEFAULT_CENTER}
                                    zoom={DEFAULT_ZOOM}
                                    scrollWheelZoom
                                    style={{ height: "100%", width: "100%" }}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {locations.map((location) => (
                                        <React.Fragment key={location.id}>
                                            <Circle
                                                center={[location.latitude, location.longitude]}
                                                radius={location.radiusMeters}
                                                pathOptions={{
                                                    color: location.isActive ? "#4f46e5" : "#9ca3af",
                                                    fillColor: location.isActive ? "#6366f1" : "#9ca3af",
                                                    fillOpacity: location.isActive ? 0.16 : 0.08,
                                                }}
                                            />
                                            <Marker position={[location.latitude, location.longitude]}>
                                                <Popup>
                                                    <strong>{location.name}</strong>
                                                    <br />
                                                    {location.isActive ? "Active" : "Inactive"} ·{" "}
                                                    {location.radiusMeters} m radius
                                                </Popup>
                                            </Marker>
                                        </React.Fragment>
                                    ))}
                                    {locations.length > 0 && <FitLocations locations={locations} />}
                                </MapContainer>
                            </Box>
                        </Paper>

                        <Box>
                            <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                                <Chip label={`${locations.length} locations`} variant="outlined" size="small" />
                                <Chip label={`${activeCount} active`} color="success" variant="outlined" size="small" />
                            </Box>

                            {loading ? (
                                <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                                    <CircularProgress size={30} />
                                </Paper>
                            ) : locations.length === 0 ? (
                                <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
                                    <PlaceOutlined sx={{ fontSize: 42, color: "#c7d2fe", mb: 1 }} />
                                    <Typography sx={{ fontWeight: 700 }}>No work locations yet</Typography>
                                    <Typography variant="body2" sx={{ color: "#6b7280", mb: 2 }}>
                                        Add a location before employees can check in.
                                    </Typography>
                                    <Button variant="contained" onClick={openCreate} sx={{ textTransform: "none" }}>
                                        Add First Location
                                    </Button>
                                </Paper>
                            ) : (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                                    {locations.map((location) => (
                                        <Paper
                                            key={location.id}
                                            variant="outlined"
                                            sx={{
                                                p: 2,
                                                borderRadius: 2.5,
                                                borderColor: location.isActive ? "#c7d2fe" : "#e5e7eb",
                                                bgcolor: location.isActive ? "#f8faff" : "#fafafa",
                                            }}
                                        >
                                            <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                                                <Box
                                                    sx={{
                                                        width: 38,
                                                        height: 38,
                                                        borderRadius: 2,
                                                        bgcolor: location.isActive ? "#eef2ff" : "#f3f4f6",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <PlaceOutlined sx={{ color: location.isActive ? "#4f46e5" : "#9ca3af" }} />
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography sx={{ fontWeight: 700, wordBreak: "break-word" }}>
                                                        {location.name}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: "#6b7280" }}>
                                                        {Number(location.latitude).toFixed(6)},{" "}
                                                        {Number(location.longitude).toFixed(6)}
                                                    </Typography>
                                                    <Box sx={{ display: "flex", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                                                        <Chip label={`${location.radiusMeters} m`} size="small" variant="outlined" />
                                                        <Chip
                                                            label={location.isActive ? "Active" : "Inactive"}
                                                            size="small"
                                                            color={location.isActive ? "success" : "default"}
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                </Box>
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    mt: 1.5,
                                                    pt: 1,
                                                    borderTop: "1px solid #eef0f4",
                                                }}
                                            >
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                    <Switch
                                                        size="small"
                                                        checked={Boolean(location.isActive)}
                                                        onChange={(e) => toggleActive(location, e.target.checked)}
                                                        inputProps={{ "aria-label": `Toggle ${location.name}` }}
                                                    />
                                                    <Typography variant="caption" sx={{ color: "#6b7280" }}>
                                                        {location.isActive ? "Enabled" : "Disabled"}
                                                    </Typography>
                                                </Box>
                                                <IconButton size="small" onClick={() => openEdit(location)} aria-label={`Edit ${location.name}`}>
                                                    <EditOutlined fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </Paper>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </div>
            </div>

            <Dialog
                open={dialogOpen}
                onClose={() => !saving && setDialogOpen(false)}
                fullWidth
                maxWidth="md"
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <PlaceOutlined sx={{ color: "#4f46e5" }} />
                        {editing ? "Edit Work Location" : "Add Work Location"}
                    </Box>
                    <IconButton onClick={() => setDialogOpen(false)} disabled={saving} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Box
                        component="form"
                        onSubmit={saveLocation}
                        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                    >
                        {formError && <Alert severity="error">{formError}</Alert>}

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 180px" }, gap: 2 }}>
                            <TextField
                                label="Location name"
                                value={form.name}
                                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                                placeholder="e.g. Head Office"
                                required
                                fullWidth
                            />
                            <TextField
                                label="Radius (meters)"
                                type="number"
                                value={form.radiusMeters}
                                onChange={(e) =>
                                    setForm((current) => ({ ...current, radiusMeters: e.target.value }))
                                }
                                inputProps={{ min: 1, max: 10000, step: 1 }}
                                required
                                fullWidth
                            />
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                            <TextField
                                label="Latitude"
                                type="number"
                                value={form.latitude}
                                onChange={(e) =>
                                    setForm((current) => ({ ...current, latitude: e.target.value }))
                                }
                                inputProps={{ step: "any", min: -90, max: 90 }}
                                required
                                fullWidth
                            />
                            <TextField
                                label="Longitude"
                                type="number"
                                value={form.longitude}
                                onChange={(e) =>
                                    setForm((current) => ({ ...current, longitude: e.target.value }))
                                }
                                inputProps={{ step: "any", min: -180, max: 180 }}
                                required
                                fullWidth
                            />
                        </Box>

                        <Button
                            variant="outlined"
                            startIcon={locating ? <CircularProgress size={16} /> : <MyLocation />}
                            onClick={useCurrentLocation}
                            disabled={locating}
                            sx={{ alignSelf: "flex-start", textTransform: "none" }}
                        >
                            {locating ? "Getting location..." : "Use my current location"}
                        </Button>

                        <Box sx={{ height: 330, borderRadius: 2, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                            <MapContainer
                                whenReady={(map) => {
                                    mapRef.current = map;
                                }}
                                center={[Number(form.latitude), Number(form.longitude)]}
                                zoom={15}
                                scrollWheelZoom
                                style={{ height: "100%", width: "100%" }}
                            >
                                <LocationPicker
                                    latitude={Number(form.latitude)}
                                    longitude={Number(form.longitude)}
                                    radiusMeters={form.radiusMeters}
                                    onChange={updatePoint}
                                />
                            </MapContainer>
                        </Box>
                        <Typography variant="caption" sx={{ color: "#6b7280" }}>
                            Click the map or drag the marker to place the center. The circle shows the allowed radius.
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ textTransform: "none" }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={saveLocation}
                        disabled={saving}
                        sx={{ textTransform: "none", bgcolor: "#4f46e5" }}
                    >
                        {saving ? "Saving..." : editing ? "Update Location" : "Add Location"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={toast.open}
                autoHideDuration={3500}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity={toast.severity}
                    variant="filled"
                    onClose={() => setToast((current) => ({ ...current, open: false }))}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default WorkLocations;
