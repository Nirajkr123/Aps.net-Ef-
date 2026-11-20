import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
    Alert,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    TextField,
} from "@mui/material";
import {
    AccessTimeOutlined,
    DownloadRounded,
    LockOutlined,
    RefreshRounded,
    SettingsOutlined,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import attendanceRegisterService from "../services/attendanceRegisterService";
import { dayKey } from "../Employee/components/attendance/attendanceUtils";
import { PageHeader, Pagination, SearchInput } from "../components/admin";
import AttendanceTabs from "./components/attendance/AttendanceTabs";
import AttendanceRegisterGrid from "./components/attendance/AttendanceRegisterGrid";
import AttendanceRegisterDrawer from "./components/attendance/AttendanceRegisterDrawer";
import AttendanceRegisterMarkDialog from "./components/attendance/AttendanceRegisterMarkDialog";
import AttendanceRegisterSettingsDialog from "./components/attendance/AttendanceRegisterSettingsDialog";
import AttendanceRegisterLockDialog from "./components/attendance/AttendanceRegisterLockDialog";
import {
    buildDownloadName,
    formatMonthLabel,
    formatRegisterTimestamp,
    getCodeMeta,
} from "./components/attendance/attendanceRegisterUi";
import "./AdminDashboard.css";
import "./AdminAttendance.css";
import "./components/attendance/AttendanceRegister.css";

const PAGE_SIZE = 25;

function AttendanceRegister() {
    const navigate = useNavigate();

    const [user] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "null");
        } catch {
            return null;
        }
    });
    const [collapsed, setCollapsed] = useState(false);

    const todayKey = dayKey(new Date());
    const [month, setMonth] = useState(todayKey.slice(0, 7));
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [locationId, setLocationId] = useState("");
    const [shiftId, setShiftId] = useState("");
    const [page, setPage] = useState(0);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshTick, setRefreshTick] = useState(0);
    const [exporting, setExporting] = useState(false);

    const [drawer, setDrawer] = useState({
        open: false,
        employeeId: null,
        date: null,
        row: null,
        day: null,
        cell: null,
        loading: false,
        error: "",
    });
    const cellRequest = useRef(0);

    const [markOpen, setMarkOpen] = useState(false);
    const [markSaving, setMarkSaving] = useState(false);
    const [markError, setMarkError] = useState("");

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsError, setSettingsError] = useState("");

    const [lockOpen, setLockOpen] = useState(false);
    const [lockSaving, setLockSaving] = useState(false);
    const [lockError, setLockError] = useState("");
    const [lockHistory, setLockHistory] = useState([]);
    const [lockHistoryLoading, setLockHistoryLoading] = useState(false);
    const [lockHistoryError, setLockHistoryError] = useState("");

    const [toast, setToast] = useState(null);

    const role = String(user?.role || "").toUpperCase();
    const authorized = ["OWNER", "HR"].includes(role);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(0);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const query = useMemo(
        () => ({
            month,
            departmentId: departmentId ? Number(departmentId) : undefined,
            locationId: locationId ? Number(locationId) : undefined,
            shiftId: shiftId ? Number(shiftId) : undefined,
            search: search || undefined,
            page: page + 1,
            pageSize: PAGE_SIZE,
        }),
        [month, departmentId, locationId, shiftId, search, page]
    );

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        attendanceRegisterService
            .getRegister(query)
            .then((response) => {
                if (active) setData(response);
            })
            .catch((requestError) => {
                if (!active) return;
                setError(
                    requestError?.message ||
                        "The attendance register could not be loaded."
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [query, refreshTick]);

    useEffect(() => {
        if (!drawer.open || !month) return;
        if (String(drawer.date || "").slice(0, 7) !== month) {
            cellRequest.current += 1;
            setDrawer((current) => ({
                ...current,
                open: false,
                cell: null,
                error: "",
            }));
        }
    }, [month, drawer.open, drawer.date]);

    const showToast = (message, severity = "success") =>
        setToast({ message, severity });

    const loadCell = useCallback(async (employeeId, date) => {
        const requestId = (cellRequest.current += 1);
        setDrawer((current) => ({ ...current, loading: true, error: "" }));

        try {
            const cell = await attendanceRegisterService.getCell(employeeId, date);
            if (requestId !== cellRequest.current) return;
            setDrawer((current) =>
                current.open &&
                String(current.employeeId) === String(employeeId) &&
                current.date === date
                    ? { ...current, cell, loading: false, error: "" }
                    : current
            );
        } catch (requestError) {
            if (requestId !== cellRequest.current) return;
            setDrawer((current) =>
                current.open &&
                String(current.employeeId) === String(employeeId) &&
                current.date === date
                    ? {
                          ...current,
                          loading: false,
                          error:
                              requestError?.message ||
                              "This day could not be loaded.",
                      }
                    : current
            );
        }
    }, []);

    const openCell = (row, day) => {
        setMarkOpen(false);
        setMarkError("");
        setDrawer({
            open: true,
            employeeId: row.employeeId,
            date: day.date,
            row,
            day,
            cell: null,
            loading: true,
            error: "",
        });
        loadCell(row.employeeId, day.date);
    };

    const closeDrawer = () => {
        cellRequest.current += 1;
        setMarkOpen(false);
        setMarkError("");
        setDrawer((current) => ({ ...current, open: false, cell: null, error: "" }));
    };

    const submitMark = async (payload) => {
        if (markSaving) return;
        setMarkSaving(true);
        setMarkError("");

        try {
            await attendanceRegisterService.markAttendance(payload);
            setMarkOpen(false);
            showToast(
                `Attendance updated for ${drawer.row?.employeeName || "the employee"}.`
            );
            setRefreshTick((value) => value + 1);
            await loadCell(payload.employeeId, payload.date);
        } catch (requestError) {
            setMarkError(
                requestError?.message ||
                    "Attendance could not be updated. Please try again."
            );
        } finally {
            setMarkSaving(false);
        }
    };

    const openSettings = () => {
        setSettingsError("");
        setSettingsOpen(true);
    };

    const submitSettings = async (payload) => {
        if (settingsSaving) return;
        setSettingsSaving(true);
        setSettingsError("");

        try {
            const updated = await attendanceRegisterService.updateSettings(payload);
            setData((current) =>
                current ? { ...current, settings: updated } : current
            );
            setSettingsOpen(false);
            showToast("Register rules saved.");
            setRefreshTick((value) => value + 1);
        } catch (requestError) {
            setSettingsError(
                requestError?.message ||
                    "Register rules could not be saved. Please try again."
            );
        } finally {
            setSettingsSaving(false);
        }
    };

    const openLock = async () => {
        setLockOpen(true);
        setLockError("");
        setLockHistory([]);
        setLockHistoryError("");
        setLockHistoryLoading(true);

        try {
            const history = await attendanceRegisterService.getLockHistory(month);
            setLockHistory(Array.isArray(history) ? history : []);
        } catch (requestError) {
            setLockHistoryError(
                requestError?.message || "Lock history could not be loaded."
            );
        } finally {
            setLockHistoryLoading(false);
        }
    };

    const submitLock = async (reason) => {
        if (lockSaving) return;
        setLockSaving(true);
        setLockError("");

        try {
            const locked = await attendanceRegisterService.lockMonth({
                month,
                reason,
            });
            setLockOpen(false);
            showToast(
                `${formatMonthLabel(month)} locked as version ${locked?.version ?? ""}.`.trim()
            );
            setRefreshTick((value) => value + 1);
        } catch (requestError) {
            setLockError(
                requestError?.message ||
                    "The register could not be locked. Please try again."
            );
        } finally {
            setLockSaving(false);
        }
    };

    const handleExport = async () => {
        if (exporting) return;
        setExporting(true);

        try {
            const { blob, filename } = await attendanceRegisterService.exportRegister(
                { ...query, page: 1, pageSize: 200 },
                buildDownloadName(month)
            );
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = filename || buildDownloadName(month);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            showToast("Register exported.");
        } catch (requestError) {
            showToast(
                requestError?.message || "The register could not be exported.",
                "error"
            );
        } finally {
            setExporting(false);
        }
    };

    const resetFilters = () => {
        setDepartmentId("");
        setLocationId("");
        setShiftId("");
        setSearchInput("");
        setSearch("");
        setPage(0);
    };

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email ||
          "Administrator"
        : "Administrator";

    if (!authorized) {
        return <Navigate to="/dashboard" replace />;
    }

    const hasFilters = Boolean(
        departmentId || locationId || shiftId || searchInput
    );
    const settings = data?.settings;

    return (
        <div className="dash-page admin-page-shell">
            <Sidebar
                activeKey="attendance-register"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed(!collapsed)}
            />
            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={role || "OWNER"}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed(!collapsed)}
                />

                <div className="dash-content">
                    <div className="admin-page att-reg-page">
                        <PageHeader
                            title="Attendance Register"
                            subtitle={`Monthly register for ${formatMonthLabel(month)} · ${
                                data?.total ?? "…"
                            } employees`}
                            actions={[
                                {
                                    key: "refresh",
                                    label: "Refresh",
                                    icon: RefreshRounded,
                                    variant: "primary",
                                    onClick: () => setRefreshTick((value) => value + 1),
                                    disabled: loading,
                                },
                                {
                                    key: "export",
                                    label: exporting ? "Exporting…" : "Export CSV",
                                    icon: DownloadRounded,
                                    onClick: handleExport,
                                    disabled: loading || exporting || !data,
                                },
                                {
                                    key: "settings",
                                    label: "Rules",
                                    icon: SettingsOutlined,
                                    onClick: openSettings,
                                    disabled: loading || !data,
                                },
                                {
                                    key: "lock",
                                    label: data?.locked ? "Reissue lock" : "Lock month",
                                    icon: LockOutlined,
                                    onClick: openLock,
                                    disabled: loading || !data,
                                },
                            ]}
                        />

                        <AttendanceTabs active="register" />

                        {data?.locked && (
                            <Alert
                                severity="warning"
                                icon={<LockOutlined />}
                                sx={{ borderRadius: "14px" }}
                                action={
                                    <button
                                        type="button"
                                        className="att-reg-link-btn"
                                        onClick={openLock}
                                    >
                                        View / reissue
                                    </button>
                                }
                            >
                                {formatMonthLabel(month)} is locked as version{" "}
                                {data.lockVersion} by {data.lockedBy || "an admin"} on{" "}
                                {formatRegisterTimestamp(data.lockedAt)}
                                {data.lockReason ? ` · ${data.lockReason}` : ""}. Cells are
                                read-only until the register is reissued.
                            </Alert>
                        )}

                        {error && (
                            <Alert
                                severity="error"
                                onClose={() => setError("")}
                                sx={{ borderRadius: "14px" }}
                                action={
                                    <button
                                        type="button"
                                        className="att-reg-link-btn"
                                        onClick={() => setRefreshTick((value) => value + 1)}
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
                                <TextField
                                    label="Month"
                                    type="month"
                                    size="small"
                                    value={month}
                                    onChange={(event) => {
                                        setMonth(event.target.value);
                                        setPage(0);
                                    }}
                                    slotProps={{
                                        inputLabel: { shrink: true },
                                        htmlInput: { max: todayKey.slice(0, 7) },
                                    }}
                                />

                                <SearchInput
                                    value={searchInput}
                                    onChange={setSearchInput}
                                    placeholder="Search employee..."
                                    ariaLabel="Search the attendance register"
                                />

                                <FormControl size="small" sx={{ minWidth: 160 }}>
                                    <InputLabel id="register-department">
                                        Department
                                    </InputLabel>
                                    <Select
                                        labelId="register-department"
                                        label="Department"
                                        value={departmentId}
                                        onChange={(event) => {
                                            setDepartmentId(event.target.value);
                                            setPage(0);
                                        }}
                                    >
                                        <MenuItem value="">All departments</MenuItem>
                                        {(data?.filters?.departments || []).map((item) => (
                                            <MenuItem key={item.id} value={String(item.id)}>
                                                {item.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel id="register-location">Location</InputLabel>
                                    <Select
                                        labelId="register-location"
                                        label="Location"
                                        value={locationId}
                                        onChange={(event) => {
                                            setLocationId(event.target.value);
                                            setPage(0);
                                        }}
                                    >
                                        <MenuItem value="">All locations</MenuItem>
                                        {(data?.filters?.locations || []).map((item) => (
                                            <MenuItem key={item.id} value={String(item.id)}>
                                                {item.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <InputLabel id="register-shift">Shift</InputLabel>
                                    <Select
                                        labelId="register-shift"
                                        label="Shift"
                                        value={shiftId}
                                        onChange={(event) => {
                                            setShiftId(event.target.value);
                                            setPage(0);
                                        }}
                                    >
                                        <MenuItem value="">All shifts</MenuItem>
                                        {(data?.filters?.shifts || []).map((item) => (
                                            <MenuItem key={item.id} value={String(item.id)}>
                                                {item.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {hasFilters && (
                                    <button
                                        type="button"
                                        className="admin-btn is-ghost-dark att-reg-reset"
                                        onClick={resetFilters}
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="att-reg-legend" aria-label="Register legend">
                            <span className="att-reg-legend-title">Legend</span>
                            {(data?.legend || []).map((item) => {
                                const meta = getCodeMeta(item.code);
                                return (
                                    <span key={item.code} className="att-reg-legend-item">
                                        <span className={`att-reg-code is-${meta.tone}`}>
                                            {meta.short}
                                        </span>
                                        {item.label}
                                    </span>
                                );
                            })}
                            {settings?.sandwichRuleEnabled && (
                                <span className="att-reg-legend-item is-rule">
                                    Sandwich rule on
                                </span>
                            )}
                            {settings?.halfDayLopEnabled && (
                                <span className="att-reg-legend-item is-rule">
                                    Half-day LOP on
                                </span>
                            )}
                        </div>

                        <AttendanceRegisterGrid
                            data={data}
                            loading={loading}
                            onCellClick={openCell}
                        />

                        <Pagination
                            page={page}
                            pageSize={PAGE_SIZE}
                            total={data?.total || 0}
                            onPageChange={setPage}
                        />

                        {!data && !loading && (
                            <div className="att-reg-empty-note">
                                <AccessTimeOutlined fontSize="small" />
                                <span>No register data is available for this month.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AttendanceRegisterDrawer
                open={drawer.open}
                row={drawer.row}
                day={drawer.day}
                cell={drawer.cell}
                loading={drawer.loading}
                error={drawer.error}
                onClose={closeDrawer}
                onRetry={() => loadCell(drawer.employeeId, drawer.date)}
                onMark={() => {
                    setMarkError("");
                    setMarkOpen(true);
                }}
            />

            <AttendanceRegisterMarkDialog
                open={markOpen}
                row={drawer.row}
                day={drawer.day}
                cell={drawer.cell}
                saving={markSaving}
                error={markError}
                onSubmit={submitMark}
                onClose={() => {
                    if (!markSaving) {
                        setMarkOpen(false);
                        setMarkError("");
                    }
                }}
            />

            <AttendanceRegisterSettingsDialog
                open={settingsOpen}
                settings={settings}
                saving={settingsSaving}
                error={settingsError}
                onClose={() => {
                    if (!settingsSaving) setSettingsOpen(false);
                }}
                onSubmit={submitSettings}
            />

            <AttendanceRegisterLockDialog
                open={lockOpen}
                data={data}
                history={lockHistory}
                historyLoading={lockHistoryLoading}
                historyError={lockHistoryError}
                saving={lockSaving}
                error={lockError}
                onClose={() => {
                    if (!lockSaving) setLockOpen(false);
                }}
                onLock={submitLock}
            />

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={4000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity={toast?.severity || "success"}
                    variant="filled"
                    onClose={() => setToast(null)}
                    sx={{ borderRadius: "12px" }}
                >
                    {toast?.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default AttendanceRegister;
