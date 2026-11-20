import React, { useEffect, useMemo, useState } from "react";
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
    EditOutlined,
    RefreshRounded,
    SettingsOutlined,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import AttendanceOverrideDrawer from "./components/attendance/AttendanceOverrideDrawer";
import AttendanceRulesDialog from "./components/attendance/AttendanceRulesDialog";
import "./AdminDashboard.css";
import "./AdminAttendance.css";

import attendanceService from "../services/attendanceService";
import {
    dayKey,
    formatHours,
    formatShortDate,
    formatTime,
    rowHours,
    unwrapList,
    unwrapOne,
} from "../Employee/components/attendance/attendanceUtils";
import {
    DataTable,
    EmptyState,
    FilterPills,
    MobileCard,
    MobileCardList,
    PageHeader,
    Pagination,
    RowActions,
    SearchInput,
    StatusBadge,
} from "../components/admin";

const PAGE_SIZE = 12;
const MOBILE_BATCH = 6;

const initialsOf = (name) =>
    (name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");

const rowDateKey = (row) => String(row?.attendanceDate || row?.date || "").slice(0, 10);

const isHalfDayStatus = (value) =>
    ["half-day", "half day", "halfday"].includes(String(value || "").trim().toLowerCase());

const shiftTimeLabel = (row) => {
    if (!row.shiftStartDt || !row.shiftEndDt) return "";
    return `${formatTime(row.shiftStartDt)} – ${formatTime(row.shiftEndDt)}${
        row.shiftCrossesMidnight ? " +1 day" : ""
    }`;
};

const decorateRow = (row, todayKey) => {
    const rawStatus = String(row.status || "").trim();
    const rawKey = rawStatus.toLowerCase();
    const isLeave = rawKey === "leave" || rawKey === "on leave";
    const isAbsent = rawKey === "absent";
    const isHalfDay = isHalfDayStatus(rawKey);
    const hasCheckIn = Boolean(row.checkInTime);
    const hasCheckOut = Boolean(row.checkOutTime);
    const dateKey = rowDateKey(row);
    const isPast = Boolean(dateKey) && dateKey < todayKey;
    const missingDetected = Boolean(row.missingPunchDetectedAt);
    const missing = !hasCheckOut
        ? hasCheckIn
            ? isPast || missingDetected
            : !isLeave && !isAbsent
        : false;
    const onDuty = hasCheckIn && !hasCheckOut && !isPast && !missingDetected;

    let status = "No Record";
    if (hasCheckIn && hasCheckOut) {
        if (isLeave) status = "Leave";
        else if (isAbsent) status = "Absent";
        else if (isHalfDay) status = "Half-day";
        else if (row.isLate) status = "Late";
        else status = "Present";
    } else if (hasCheckIn) {
        status = missingDetected || isPast ? "Missed Checkout" : "On Duty";
    } else if (isLeave) {
        status = "Leave";
    } else if (isAbsent) {
        status = "Absent";
    } else if (isHalfDay) {
        status = "Half-day";
    }

    const flags = [];
    if (row.isLate) flags.push({ key: "late", label: "Late", tone: "warn" });
    if (missingDetected) {
        flags.push({ key: "missed-punch", label: "Missed punch", tone: "danger" });
    } else if (hasCheckIn && !hasCheckOut && isPast) {
        flags.push({ key: "no-checkout", label: "No checkout", tone: "danger" });
    }
    if (!hasCheckIn && !isLeave && !isAbsent) {
        flags.push({ key: "no-checkin", label: "No check-in", tone: "danger" });
    }
    if (onDuty) flags.push({ key: "open", label: "Open shift", tone: "neutral" });
    if (String(row.source || "").toUpperCase() === "ADMIN_OVERRIDE") {
        flags.push({ key: "manual", label: "Manual", tone: "neutral" });
    }
    if (!row.shiftName) flags.push({ key: "no-shift", label: "No shift", tone: "neutral" });

    return {
        ...row,
        __dateKey: dateKey,
        __status: status,
        __present: hasCheckIn && hasCheckOut && !isLeave && !isAbsent,
        __onDuty: onDuty,
        __missing: missing,
        __flags: flags,
    };
};

const matchesStatusFilter = (row, filter) => {
    switch (filter) {
        case "present":
            return row.__present;
        case "late":
            return row.isLate === true;
        case "on-duty":
            return row.__onDuty;
        case "missed":
            return row.__missing;
        case "absent":
            return row.__status === "Absent";
        case "leave":
            return row.__status === "Leave";
        case "half-day":
            return row.__status === "Half-day";
        default:
            return true;
    }
};

function AdminAttendance() {
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
    const [date, setDate] = useState(todayKey);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshTick, setRefreshTick] = useState(0);

    const [search, setSearch] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [page, setPage] = useState(0);
    const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);

    const [overrideTarget, setOverrideTarget] = useState(null);
    const [overrideSaving, setOverrideSaving] = useState(false);
    const [overrideError, setOverrideError] = useState("");
    const [toast, setToast] = useState("");
    const [rulesOpen, setRulesOpen] = useState(false);
    const [rulesConfig, setRulesConfig] = useState(null);
    const [rulesLoading, setRulesLoading] = useState(false);
    const [rulesSaving, setRulesSaving] = useState(false);
    const [rulesError, setRulesError] = useState("");

    const role = String(user?.role || "").toUpperCase();
    const authorized = ["OWNER", "HR"].includes(role);

    const range = useMemo(() => {
        const target = date || todayKey;
        return { fromDate: target, toDate: target };
    }, [date, todayKey]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        attendanceService
            .getAll(range)
            .then((response) => {
                if (active) setRows(unwrapList(response));
            })
            .catch((requestError) => {
                if (!active) return;
                setRows([]);
                setError(
                    requestError?.message ||
                        "Attendance could not be loaded. Please try again."
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [range, refreshTick]);

    useEffect(() => {
        setPage(0);
        setMobileVisible(MOBILE_BATCH);
    }, [search, departmentFilter, statusFilter, range]);

    const decorated = useMemo(
        () => rows.map((row) => decorateRow(row, todayKey)),
        [rows, todayKey]
    );

    const departments = useMemo(
        () =>
            Array.from(
                new Set(decorated.map((row) => row.department).filter(Boolean))
            ).sort((left, right) => left.localeCompare(right)),
        [decorated]
    );

    const scoped = useMemo(() => {
        const term = search.trim().toLowerCase();
        return decorated.filter((row) => {
            if (departmentFilter && row.department !== departmentFilter) return false;
            if (!term) return true;
            return [row.employeeName, row.employeeCode, row.employeeEmail, row.department]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(term);
        });
    }, [decorated, departmentFilter, search]);

    const counts = useMemo(() => {
        const result = {
            all: scoped.length,
            present: 0,
            late: 0,
            "on-duty": 0,
            missed: 0,
            absent: 0,
            leave: 0,
            "half-day": 0,
        };

        scoped.forEach((row) => {
            if (row.__present) result.present += 1;
            if (row.isLate) result.late += 1;
            if (row.__onDuty) result["on-duty"] += 1;
            if (row.__missing) result.missed += 1;
            if (row.__status === "Absent") result.absent += 1;
            if (row.__status === "Leave") result.leave += 1;
            if (row.__status === "Half-day") result["half-day"] += 1;
        });

        return result;
    }, [scoped]);

    const visible = useMemo(
        () => scoped.filter((row) => matchesStatusFilter(row, statusFilter)),
        [scoped, statusFilter]
    );

    const hasFilters = Boolean(search || departmentFilter || statusFilter !== "all");

    const resetFilters = () => {
        setSearch("");
        setDepartmentFilter("");
        setStatusFilter("all");
    };

    const openOverride = (row) => {
        setOverrideError("");
        setOverrideTarget(row);
    };

    const closeOverride = () => {
        if (overrideSaving) return;
        setOverrideTarget(null);
        setOverrideError("");
    };

    const submitOverride = async (payload) => {
        if (!overrideTarget || overrideSaving) return;

        const target = overrideTarget;
        setOverrideSaving(true);
        setOverrideError("");

        try {
            const response = await attendanceService.override(target.id, payload);
            const updated = unwrapOne(response);

            setRows((current) =>
                current.map((row) =>
                    row.id === target.id ? { ...row, ...(updated || {}) } : row
                )
            );
            setOverrideTarget(null);
            setToast(
                `Attendance updated for ${target.employeeName || "the employee"}.`
            );
        } catch (requestError) {
            setOverrideError(
                requestError?.response?.data?.message ||
                    requestError?.message ||
                    "Attendance could not be updated. Please try again."
            );
        } finally {
            setOverrideSaving(false);
        }
    };

    const openRules = async () => {
        setRulesOpen(true);
        setRulesLoading(true);
        setRulesError("");

        try {
            const { data } = await attendanceService.getConfig();
            setRulesConfig(data);
        } catch (requestError) {
            setRulesError(
                requestError?.response?.data?.message ||
                    requestError?.message ||
                    "Check-in rules could not be loaded. Please try again."
            );
        } finally {
            setRulesLoading(false);
        }
    };

    const saveRules = async (payload) => {
        if (rulesSaving) return;

        setRulesSaving(true);
        setRulesError("");

        try {
            const { data } = await attendanceService.updateConfig(payload);
            setRulesConfig(data);
            setRulesOpen(false);
            setToast("Check-in window updated.");
        } catch (requestError) {
            setRulesError(
                requestError?.response?.data?.message ||
                    requestError?.message ||
                    "Check-in window could not be saved. Please try again."
            );
        } finally {
            setRulesSaving(false);
        }
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

    const columns = [
        {
            key: "employee",
            header: "Employee",
            render: (row) => (
                <span className="adm-att-person">
                    <span className="adm-att-avatar" aria-hidden="true">
                        {initialsOf(row.employeeName)}
                    </span>
                    <span className="adm-att-person-copy">
                        <span className="admin-cell-primary">
                            {row.employeeName || "Unknown employee"}
                        </span>
                        <span className="admin-cell-sub">
                            {[row.employeeCode, row.employeeEmail].filter(Boolean).join(" · ") || "—"}
                        </span>
                    </span>
                </span>
            ),
        },
        {
            key: "date",
            header: "Date",
            render: (row) => (
                <span className="adm-att-date">{formatShortDate(row.__dateKey)}</span>
            ),
        },
        {
            key: "department",
            header: "Department",
            render: (row) => row.department || <span className="adm-att-muted">—</span>,
        },
        {
            key: "shift",
            header: "Shift",
            render: (row) => (
                <span className="adm-att-shift">
                    <span className="admin-cell-primary">{row.shiftName || "Unassigned"}</span>
                    {shiftTimeLabel(row) && (
                        <span className="admin-cell-sub">{shiftTimeLabel(row)}</span>
                    )}
                </span>
            ),
        },
        {
            key: "times",
            header: "Check In / Out",
            render: (row) => (
                <span className="adm-att-times">
                    <span>
                        <em>In</em> {formatTime(row.checkInTime)}
                    </span>
                    <span>
                        <em>Out</em> {formatTime(row.checkOutTime)}
                    </span>
                </span>
            ),
        },
        {
            key: "hours",
            header: "Hours",
            align: "center",
            render: (row) => (
                <span className="adm-att-hours">{formatHours(rowHours(row))}</span>
            ),
        },
        {
            key: "flags",
            header: "Flags",
            render: (row) =>
                row.__flags.length > 0 ? (
                    <span className="adm-att-flags">
                        {row.__flags.map((flag) => (
                            <span
                                key={flag.key}
                                className={`adm-att-flag is-${flag.tone}`}
                            >
                                {flag.label}
                            </span>
                        ))}
                    </span>
                ) : (
                    <span className="adm-att-muted">—</span>
                ),
        },
        {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.__status} />,
        },
        {
            key: "actions",
            header: "",
            align: "right",
            render: (row) => (
                <RowActions
                    actions={[
                        {
                            key: "override",
                            label: "Override attendance",
                            icon: EditOutlined,
                            onClick: () => openOverride(row),
                        },
                    ]}
                />
            ),
        },
    ];

    const emptyState = (
        <EmptyState
            icon={<AccessTimeOutlined />}
            title={
                hasFilters
                    ? "No attendance records match these filters."
                    : "No attendance records for this period."
            }
            subtitle={
                hasFilters
                    ? "Try another employee, department or status."
                    : "Records will appear here once employees start punching in."
            }
            action={
                hasFilters ? (
                    <button
                        type="button"
                        className="admin-btn is-ghost-dark"
                        onClick={resetFilters}
                    >
                        Reset filters
                    </button>
                ) : null
            }
        />
    );

    const filterOptions = [
        { key: "all", label: "All", count: counts.all },
        { key: "present", label: "Present", count: counts.present },
        { key: "late", label: "Late", count: counts.late },
        { key: "on-duty", label: "On duty", count: counts["on-duty"] },
        { key: "missed", label: "Missing", count: counts.missed },
        { key: "absent", label: "Absent", count: counts.absent },
        { key: "leave", label: "Leave", count: counts.leave },
        { key: "half-day", label: "Half-day", count: counts["half-day"] },
    ];

    const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pagedRows = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const mobileRows = visible.slice(0, mobileVisible);

    if (!authorized) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="dash-page admin-page-shell">
            <Sidebar
                activeKey="attendance"
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
                    <div className="admin-page">
                        <PageHeader
                            title="Attendance"
                            subtitle={`Attendance for ${formatShortDate(
                                range.fromDate
                            )} across all shifts`}
                            actions={[
                                {
                                    key: "rules",
                                    label: "Check-in rules",
                                    icon: SettingsOutlined,
                                    onClick: openRules,
                                    disabled: loading,
                                },
                                {
                                    key: "refresh",
                                    label: "Refresh",
                                    icon: RefreshRounded,
                                    variant: "primary",
                                    onClick: () => setRefreshTick((value) => value + 1),
                                    disabled: loading,
                                },
                            ]}
                        />

                        {error && (
                            <Alert
                                severity="error"
                                onClose={() => setError("")}
                                sx={{ borderRadius: "14px" }}
                            >
                                {error}
                            </Alert>
                        )}

                        <div className="admin-toolbar">
                            <div className="admin-toolbar-left">
                                <TextField
                                    label="Date"
                                    type="date"
                                    size="small"
                                    value={date}
                                    onChange={(event) => setDate(event.target.value)}
                                    slotProps={{
                                        inputLabel: { shrink: true },
                                        htmlInput: { max: todayKey },
                                    }}
                                />

                                <SearchInput
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Search employee..."
                                    ariaLabel="Search attendance records"
                                />

                                <FormControl size="small" sx={{ minWidth: 160 }}>
                                    <InputLabel id="admin-attendance-department">
                                        Department
                                    </InputLabel>
                                    <Select
                                        labelId="admin-attendance-department"
                                        label="Department"
                                        value={departmentFilter}
                                        onChange={(event) =>
                                            setDepartmentFilter(event.target.value)
                                        }
                                    >
                                        <MenuItem value="">All departments</MenuItem>
                                        {departments.map((department) => (
                                            <MenuItem key={department} value={department}>
                                                {department}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </div>

                            <div className="admin-toolbar-right">
                                <FilterPills
                                    ariaLabel="Filter attendance by status"
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={filterOptions}
                                />
                            </div>
                        </div>

                        <DataTable
                            ariaLabel="Attendance records"
                            columns={columns}
                            rows={pagedRows}
                            rowKey="id"
                            loading={loading}
                            skeletonRows={PAGE_SIZE}
                            empty={emptyState}
                        />

                        <Pagination
                            page={safePage}
                            pageSize={PAGE_SIZE}
                            total={visible.length}
                            onPageChange={setPage}
                        />

                        <MobileCardList
                            items={mobileRows}
                            loading={loading}
                            getKey={(row) => row.id}
                            hasMore={visible.length > mobileVisible}
                            onLoadMore={() =>
                                setMobileVisible((value) => value + MOBILE_BATCH)
                            }
                            empty={emptyState}
                            renderItem={(row) => (
                                <MobileCard
                                    title={row.employeeName || "Unknown employee"}
                                    subtitle={
                                        [row.department, row.employeeCode]
                                            .filter(Boolean)
                                            .join(" · ") ||
                                        row.employeeEmail ||
                                        "—"
                                    }
                                    badge={<StatusBadge status={row.__status} />}
                                    fields={[
                                        { label: "Date", value: formatShortDate(row.__dateKey) },
                                        { label: "Shift", value: row.shiftName || "Unassigned" },
                                        { label: "Check in", value: formatTime(row.checkInTime) },
                                        { label: "Check out", value: formatTime(row.checkOutTime) },
                                        { label: "Hours", value: formatHours(rowHours(row)) },
                                        {
                                            label: "Flags",
                                            value:
                                                row.__flags.length > 0
                                                    ? row.__flags
                                                          .map((flag) => flag.label)
                                                          .join(", ")
                                                    : "None",
                                        },
                                    ]}
                                    actions={[
                                        {
                                            key: "override",
                                            label: "Override attendance",
                                            icon: EditOutlined,
                                            onClick: () => openOverride(row),
                                        },
                                    ]}
                                    ariaLabel={`${row.employeeName || "Employee"} attendance on ${formatShortDate(
                                        row.__dateKey
                                    )}`}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>

            <AttendanceOverrideDrawer
                open={Boolean(overrideTarget)}
                row={overrideTarget}
                onClose={closeOverride}
                onSubmit={submitOverride}
                saving={overrideSaving}
                error={overrideError}
            />

            <AttendanceRulesDialog
                open={rulesOpen}
                config={rulesConfig}
                loading={rulesLoading}
                saving={rulesSaving}
                error={rulesError}
                onClose={() => {
                    if (!rulesSaving) setRulesOpen(false);
                }}
                onSubmit={saveRules}
            />

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={4000}
                onClose={() => setToast("")}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity="success"
                    variant="filled"
                    onClose={() => setToast("")}
                    sx={{ borderRadius: "12px" }}
                >
                    {toast}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default AdminAttendance;
