import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, CircularProgress, Snackbar, TextField } from "@mui/material";
import {
    AddLocationAlt,
    EditOutlined,
    MyLocation,
    Refresh as RefreshIcon,
    ToggleOff,
    ToggleOn,
} from "@mui/icons-material";
import {
    Circle,
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import adminServ from "../services/adminService";
import "./AdminDashboard.css";
import "./WorkLocations.css";
import {
    CountBadge,
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

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [22.8046, 86.2029];
const DEFAULT_ZOOM = 13;
const PAGE_SIZE = 10;
const MOBILE_BATCH = 5;
const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const blankForm = {
    name: "",
    latitude: DEFAULT_CENTER[0],
    longitude: DEFAULT_CENTER[1],
    radiusMeters: 100,
};

const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toCoord = (value, fallback) =>
    value === "" || value == null || !Number.isFinite(Number(value))
        ? fallback
        : Number(value);

const formatAdded = (value) => {
    if (!value) return "Attendance geofence";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Attendance geofence";
    const day = String(date.getDate()).padStart(2, "0");
    return `Added ${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

function FitLocations({ locations }) {
    const map = useMap();

    useEffect(() => {
        const points = locations
            .map((location) => [Number(location.latitude), Number(location.longitude)])
            .filter(([latitude, longitude]) =>
                Number.isFinite(latitude) && Number.isFinite(longitude)
            );

        if (points.length === 0) return;
        if (points.length === 1) {
            map.setView(points[0], 15);
            return;
        }

        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
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
                pathOptions={{ color: "#4b3fd1", fillColor: "#7b5cf0", fillOpacity: 0.18 }}
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
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(blankForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [locating, setLocating] = useState(false);
    const [page, setPage] = useState(0);
    const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);
    const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
    const mapRef = useRef(null);

    const showToast = (message, severity = "success") =>
        setToast({ open: true, message, severity });

    useEffect(() => {
        try {
            setUser(JSON.parse(localStorage.getItem("user") || "null"));
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        setPage(0);
        setMobileVisible(MOBILE_BATCH);
    }, [search, statusFilter]);

    useEffect(() => {
        if (!drawerOpen) return undefined;
        const timer = setTimeout(() => mapRef.current?.invalidateSize(), 260);
        return () => clearTimeout(timer);
    }, [drawerOpen]);

    const loadLocations = useCallback(async ({ showLoader = true } = {}) => {
        if (showLoader) setLoading(true);
        setError("");
        try {
            const { data } = await adminServ.getWorkLocations();
            setLocations(Array.isArray(data) ? data : []);
        } catch (err) {
            const message = "Work locations load nahi ho payi. Phir try karein.";
            setError(message);
            setToast({ open: true, message, severity: "error" });
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLocations({ showLoader: true });
    }, [loadLocations]);

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

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
        setDrawerOpen(true);
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
        setDrawerOpen(true);
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
                setFormError(
                    "Could not get your current location. Please allow location access."
                );
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const saveLocation = async () => {
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
            setDrawerOpen(false);
            await loadLocations({ showLoader: false });
        } catch (err) {
            setFormError(
                err.response?.data?.message || "Could not save this work location."
            );
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (location, isActive) => {
        try {
            await adminServ.setWorkLocationActive(location.id, isActive);
            setLocations((current) =>
                current.map((item) =>
                    item.id === location.id ? { ...item, isActive } : item
                )
            );
            showToast(isActive ? "Work location activated." : "Work location deactivated.");
        } catch (err) {
            showToast(
                err.response?.data?.message || "Could not update this work location.",
                "error"
            );
        }
    };

    const searchedLocations = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return locations;
        return locations.filter((location) =>
            String(location.name || "").toLowerCase().includes(query)
        );
    }, [locations, search]);

    const counts = useMemo(
        () => ({
            all: searchedLocations.length,
            active: searchedLocations.filter((location) => location.isActive).length,
            inactive: searchedLocations.filter((location) => !location.isActive).length,
        }),
        [searchedLocations]
    );

    const filteredLocations = useMemo(() => {
        if (statusFilter === "all") return searchedLocations;
        if (statusFilter === "active") {
            return searchedLocations.filter((location) => location.isActive);
        }
        return searchedLocations.filter((location) => !location.isActive);
    }, [searchedLocations, statusFilter]);

    const pageCount = Math.max(1, Math.ceil(filteredLocations.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pagedLocations = filteredLocations.slice(
        safePage * PAGE_SIZE,
        safePage * PAGE_SIZE + PAGE_SIZE
    );
    const mobileLocations = filteredLocations.slice(0, mobileVisible);

    const activeCount = locations.filter((location) => location.isActive).length;

    const formLat = toCoord(form.latitude, DEFAULT_CENTER[0]);
    const formLng = toCoord(form.longitude, DEFAULT_CENTER[1]);

    const locationActions = (location) => [
        {
            key: "toggle",
            label: location.isActive ? "Deactivate" : "Activate",
            ariaLabel: `${
                location.isActive ? "Deactivate" : "Activate"
            } ${location.name}`,
            icon: location.isActive ? ToggleOn : ToggleOff,
            onClick: () => toggleActive(location, !location.isActive),
        },
        {
            key: "edit",
            label: "Edit",
            ariaLabel: `Edit ${location.name}`,
            icon: EditOutlined,
            onClick: () => openEdit(location),
        },
    ];

    const columns = [
        {
            key: "name",
            header: "Location",
            render: (location) => (
                <>
                    <span className="admin-cell-primary">{location.name}</span>
                    <span className="admin-cell-sub">
                        {formatAdded(location.createdAt)}
                    </span>
                </>
            ),
        },
        {
            key: "radius",
            header: "Radius",
            render: (location) => (
                <span className="wl-radius">
                    {num(location.radiusMeters)} m
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (location) => (
                <StatusBadge status={location.isActive ? "Active" : "Inactive"} />
            ),
        },
        {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (location) => <RowActions actions={locationActions(location)} />,
        },
    ];

    const hasFilters = Boolean(search.trim()) || statusFilter !== "all";
    const emptyState = error ? (
        <EmptyState
            title="Work locations load nahi ho payi."
            subtitle={error}
            action={
                <button
                    type="button"
                    className="admin-btn is-primary-solid"
                    onClick={() => loadLocations({ showLoader: true })}
                >
                    Try again
                </button>
            }
        />
    ) : (
        <EmptyState
            title={hasFilters ? "Koi work location nahi mili." : "Abhi koi work location nahi hai."}
            subtitle={
                hasFilters
                    ? "Search ya filter badal kar try karein."
                    : "Pehli geofence location add karein taaki attendance allow ho sake."
            }
            action={
                !hasFilters ? (
                    <button
                        type="button"
                        className="admin-btn is-primary-solid"
                        onClick={openCreate}
                    >
                        Add Location
                    </button>
                ) : null
            }
        />
    );

    return (
        <div className="dash-page admin-page-shell">
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
                    userName={
                        [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin"
                    }
                    userRole={user?.role || "OWNER"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed(!collapsed)}
                />
                <div className="dash-content">
                    <div className="admin-page">
                        <PageHeader
                            title="Work Locations"
                            subtitle="Attendance is allowed only inside these geofence ranges."
                            actions={[
                                {
                                    key: "refresh",
                                    label: "Refresh",
                                    icon: RefreshIcon,
                                    onClick: () => loadLocations({ showLoader: true }),
                                    disabled: loading,
                                },
                                {
                                    key: "add",
                                    label: "Add Location",
                                    icon: AddLocationAlt,
                                    variant: "primary",
                                    onClick: openCreate,
                                },
                            ]}
                        />

                        <div className="admin-toolbar">
                            <div className="admin-toolbar-left">
                                <SearchInput
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Search work locations..."
                                    ariaLabel="Search work locations"
                                />
                            </div>
                            <div className="admin-toolbar-right">
                                <FilterPills
                                    ariaLabel="Filter work locations by status"
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={[
                                        { key: "all", label: "All", count: counts.all },
                                        {
                                            key: "active",
                                            label: "Active",
                                            count: counts.active,
                                        },
                                        {
                                            key: "inactive",
                                            label: "Inactive",
                                            count: counts.inactive,
                                        },
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="wl-content">
                            <div className="wl-map">
                                <div className="wl-map-card">
                                    <div className="wl-map-head">
                                        <div>
                                            <h2>Geofence Map</h2>
                                            <p>Attendance is allowed inside these circles.</p>
                                        </div>
                                        <div className="wl-map-counts">
                                            <CountBadge
                                                value={locations.length}
                                                label={
                                                    locations.length === 1
                                                        ? "location"
                                                        : "locations"
                                                }
                                                ariaLabel={`${locations.length} work locations`}
                                            />
                                            <StatusBadge
                                                status="Active"
                                                label={`${activeCount} active`}
                                            />
                                        </div>
                                    </div>

                                    <div className="wl-map-body">
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
                                                        center={[
                                                            Number(location.latitude),
                                                            Number(location.longitude),
                                                        ]}
                                                        radius={num(location.radiusMeters, 100)}
                                                        pathOptions={{
                                                            color: location.isActive
                                                                ? "#4b3fd1"
                                                                : "#9ca3af",
                                                            fillColor: location.isActive
                                                                ? "#7b5cf0"
                                                                : "#9ca3af",
                                                            fillOpacity: location.isActive
                                                                ? 0.16
                                                                : 0.08,
                                                        }}
                                                    />
                                                    <Marker
                                                        position={[
                                                            Number(location.latitude),
                                                            Number(location.longitude),
                                                        ]}
                                                    >
                                                        <Popup>
                                                            <strong>{location.name}</strong>
                                                            <br />
                                                            {location.isActive
                                                                ? "Active"
                                                                : "Inactive"}{" "}
                                                            ·{" "}
                                                            {num(location.radiusMeters)} m
                                                            radius
                                                        </Popup>
                                                    </Marker>
                                                </React.Fragment>
                                            ))}
                                            {locations.length > 0 && (
                                                <FitLocations locations={locations} />
                                            )}
                                        </MapContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="wl-list">
                                <DataTable
                                    ariaLabel="Work locations"
                                    columns={columns}
                                    rows={pagedLocations}
                                    rowKey="id"
                                    loading={loading}
                                    skeletonRows={PAGE_SIZE}
                                    empty={emptyState}
                                />

                                <Pagination
                                    page={safePage}
                                    pageSize={PAGE_SIZE}
                                    total={filteredLocations.length}
                                    onPageChange={setPage}
                                />

                                <MobileCardList
                                    items={mobileLocations}
                                    loading={loading}
                                    getKey={(location) => location.id}
                                    hasMore={
                                        filteredLocations.length > mobileVisible
                                    }
                                    onLoadMore={() =>
                                        setMobileVisible((prev) => prev + MOBILE_BATCH)
                                    }
                                    empty={emptyState}
                                    renderItem={(location) => (
                                        <MobileCard
                                            title={location.name}
                                            subtitle={formatAdded(location.createdAt)}
                                            badge={
                                                <StatusBadge
                                                    status={
                                                        location.isActive
                                                            ? "Active"
                                                            : "Inactive"
                                                    }
                                                />
                                            }
                                            fields={[
                                                {
                                                    label: "Radius",
                                                    value: `${num(
                                                        location.radiusMeters
                                                    )} m`,
                                                },
                                            ]}
                                            actions={locationActions(location)}
                                            ariaLabel={`${location.name} work location`}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <FormDrawer
                open={drawerOpen}
                title={editing ? "Edit Work Location" : "Add Work Location"}
                submitLabel={editing ? "Update Location" : "Add Location"}
                saving={saving}
                error={formError}
                onClose={() => {
                    if (!saving) setDrawerOpen(false);
                }}
                onSubmit={saveLocation}
            >
                <div className="admin-form">
                    <TextField
                        label="Location name"
                        value={form.name}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                name: event.target.value,
                            }))
                        }
                        placeholder="e.g. Head Office"
                        fullWidth
                        size="small"
                        autoFocus
                    />

                    <div className="admin-form-row">
                        <TextField
                            label="Latitude"
                            type="number"
                            value={form.latitude}
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    latitude: event.target.value,
                                }))
                            }
                            inputProps={{ step: "any", min: -90, max: 90 }}
                            fullWidth
                            size="small"
                        />
                        <TextField
                            label="Longitude"
                            type="number"
                            value={form.longitude}
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    longitude: event.target.value,
                                }))
                            }
                            inputProps={{ step: "any", min: -180, max: 180 }}
                            fullWidth
                            size="small"
                        />
                    </div>

                    <TextField
                        label="Radius (meters)"
                        type="number"
                        value={form.radiusMeters}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                radiusMeters: event.target.value,
                            }))
                        }
                        inputProps={{ min: 1, max: 10000, step: 1 }}
                        fullWidth
                        size="small"
                    />

                    <button
                        type="button"
                        className="admin-btn is-ghost-dark wl-locate-btn"
                        onClick={useCurrentLocation}
                        disabled={locating}
                    >
                        {locating ? (
                            <CircularProgress size={16} color="inherit" />
                        ) : (
                            <MyLocation fontSize="small" />
                        )}
                        <span>
                            {locating
                                ? "Getting location..."
                                : "Use my current location"}
                        </span>
                    </button>

                    <div className="wl-picker">
                        <MapContainer
                            whenReady={(map) => {
                                mapRef.current = map;
                                setTimeout(() => {
                                    if (mapRef.current === map) {
                                        map.invalidateSize();
                                    }
                                }, 300);
                            }}
                            center={[formLat, formLng]}
                            zoom={15}
                            scrollWheelZoom
                            style={{ height: "100%", width: "100%" }}
                        >
                            <LocationPicker
                                latitude={formLat}
                                longitude={formLng}
                                radiusMeters={form.radiusMeters}
                                onChange={updatePoint}
                            />
                        </MapContainer>
                    </div>

                    <p className="wl-map-hint">
                        Click the map or drag the marker to place the center. The circle
                        shows the allowed radius.
                    </p>
                </div>
            </FormDrawer>

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
                    sx={{ borderRadius: "12px" }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default WorkLocations;
