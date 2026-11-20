import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
} from "@mui/material";
import {
  AddRounded,
  CheckCircle,
  Close,
  DeleteOutlineOutlined,
  Groups,
  RadioButtonUnchecked,
  RefreshRounded,
  VisibilityOutlined,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import "./ShiftAssign.css";
import shiftService from "../../services/shiftService";
import employeeServ from "../../services/employeeService";
import {
  formatDate,
  formatDateTime,
  getAvatarGradient,
  getInitials,
  getShiftPalette,
  timeText,
  toInputDate,
} from "./shiftUi";
import {
  ConfirmModal,
  CountBadge,
  DataTable,
  EmptyState,
  MobileCard,
  MobileCardList,
  PageHeader,
  Pagination,
  RowActions,
  SearchInput,
} from "../../components/admin";

const PAGE_SIZE = 10;
const MOBILE_BATCH = 5;

const employeeName = (employee) =>
  [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
  employee?.email ||
  "Employee";

const parseInputDate = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const dayCountOf = (from, to) => {
  if (!from || !to || to < from) return 0;
  return Math.round((to - from) / 86400000) + 1;
};

const shiftKey = (name) => String(name || "").trim().toLowerCase();

const roleLabel = (role) => {
  if (!role) return "Admin";
  if (role === "OWNER") return "Owner";
  if (role === "HR") return "HR";
  return role;
};

const isSameDay = (from, to) =>
  String(from || "").slice(0, 10) === String(to || "").slice(0, 10);

function ShiftAssign() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(0);
  const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [fromDate, setFromDate] = useState(toInputDate(new Date()));
  const [toDate, setToDate] = useState(toInputDate(new Date()));
  const [workDescription, setWorkDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDepartment, setEmployeeDepartment] = useState("");
  const [employeeTab, setEmployeeTab] = useState("all");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [conflicts, setConflicts] = useState([]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const showToast = useCallback(
    (message, severity = "success") =>
      setToast({ open: true, message, severity }),
    []
  );

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

  const loadRows = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await shiftService.getAssignments();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Could not load shift assignments. Please try again.");
      showToast("Assignments load nahi ho paye.", "error");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [showToast]);

  const loadEmployees = useCallback(async () => {
    try {
      const { data } = await employeeServ.getAll({ status: "Active" });
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast("Employees load nahi ho paye.", "error");
    }
  }, [showToast]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shiftRes, employeeRes, logRes] = await Promise.all([
        shiftService.getActive(),
        employeeServ.getAll({ status: "Active" }),
        shiftService.getAssignments(),
      ]);
      setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : []);
      setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
      setRows(Array.isArray(logRes.data) ? logRes.data : []);
    } catch (err) {
      setError("Could not load shift assignment data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setPage(0);
    setMobileVisible(MOBILE_BATCH);
  }, [search, shiftFilter, departmentFilter]);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...employees.map((employee) => employee.departmentName),
            ...rows.map((row) => row.departmentName),
          ].filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [employees, rows]
  );

  const shiftByKey = useMemo(() => {
    const map = new Map();
    shifts.forEach((shift) => map.set(shiftKey(shift.shiftName), shift));
    return map;
  }, [shifts]);

  const currentShiftOf = useCallback(
    (employee) => shiftByKey.get(shiftKey(employee?.shiftName)) || null,
    [shiftByKey]
  );

  const shiftTabs = useMemo(() => {
    const unassigned = employees.filter((employee) => !currentShiftOf(employee))
      .length;

    return [
      { key: "all", label: "All Employees", count: employees.length },
      ...shifts.map((shift) => ({
        key: `shift-${shift.shiftId}`,
        label: shift.shiftName,
        count: employees.filter(
          (employee) => currentShiftOf(employee)?.shiftId === shift.shiftId
        ).length,
      })),
      { key: "unassigned", label: "Unassigned", count: unassigned },
    ];
  }, [employees, shifts, currentShiftOf]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (shiftFilter !== "all" && Number(row.shiftId) !== Number(shiftFilter)) {
        return false;
      }
      if (departmentFilter && row.departmentName !== departmentFilter) {
        return false;
      }
      if (!query) return true;
      return [
        row.employeeName,
        row.employeeCode,
        row.departmentName,
        row.shiftName,
        row.createdByName,
        row.workDescription,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, search, shiftFilter, departmentFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = filteredRows.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  const mobileRows = filteredRows.slice(0, mobileVisible);

  const dayCount = useMemo(
    () => dayCountOf(parseInputDate(fromDate), parseInputDate(toDate)),
    [fromDate, toDate]
  );

  const selectedShift = shifts.find(
    (shift) => Number(shift.shiftId) === Number(selectedShiftId)
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    const tabShiftId =
      employeeTab.startsWith("shift-") ? Number(employeeTab.slice(6)) : null;

    return employees.filter((employee) => {
      if (employeeDepartment && employee.departmentName !== employeeDepartment) {
        return false;
      }

      if (employeeTab === "unassigned") {
        if (currentShiftOf(employee)) return false;
      } else if (tabShiftId !== null) {
        if (currentShiftOf(employee)?.shiftId !== tabShiftId) return false;
      }

      if (!query) return true;
      return [employeeName(employee), employee.employeeCode, employee.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    employees,
    employeeSearch,
    employeeDepartment,
    employeeTab,
    currentShiftOf,
  ]);

  const totalAssignments = selectedIds.length * dayCount;

  const resetForm = () => {
    setEditingRow(null);
    setSelectedShiftId("");
    setFromDate(toInputDate(new Date()));
    setToDate(toInputDate(new Date()));
    setWorkDescription("");
    setSelectedIds([]);
    setEmployeeSearch("");
    setEmployeeDepartment("");
    setEmployeeTab("all");
    setFormError("");
    setConflicts([]);
  };

  const openAssign = () => {
    resetForm();
    setModalOpen(true);
  };

  const openReassign = (row) => {
    const existingTo = parseInputDate(row.toDate);
    const today = new Date();
    const next = existingTo ? addDays(existingTo, 1) : today;
    const start = next > today ? next : today;

    setEditingRow(row);
    setSelectedShiftId(row.shiftId);
    setFromDate(toInputDate(start));
    setToDate(toInputDate(start));
    setWorkDescription(row.workDescription || "");
    setSelectedIds([row.empId]);
    setEmployeeSearch("");
    setEmployeeDepartment("");
    setEmployeeTab("all");
    setFormError("");
    setConflicts([]);
    setModalOpen(true);
  };

  const applyPreset = (preset) => {
    const now = new Date();
    let from = now;
    let to = now;

    if (preset === "3days") {
      to = addDays(now, 2);
    } else if (preset === "week") {
      to = addDays(now, 6);
    } else if (preset === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    setFromDate(toInputDate(from));
    setToDate(toInputDate(to));
    setFormError("");
  };

  const toggleEmployee = (employeeId) => {
    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    );
  };

  const selectShown = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredEmployees.forEach((employee) => next.add(employee.id));
      return Array.from(next);
    });
  };

  const buildOptimisticRows = (batchId, matchedEmployees, shift) => {
    const creatorName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.email ||
      "You";

    return matchedEmployees.map((employee) => ({
      batchId,
      empId: employee.id,
      employeeName: employeeName(employee),
      employeeCode: employee.employeeCode,
      departmentName: employee.departmentName,
      shiftId: shift.shiftId,
      shiftName: shift.shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      durationHours: shift.durationHours,
      fromDate,
      toDate,
      workDescription: workDescription.trim() || null,
      status: "Active",
      createdByName: creatorName,
      createdByRole: user?.role || "OWNER",
      createdAt: new Date().toISOString(),
    }));
  };

  const handleAssign = async (event) => {
    event?.preventDefault();
    setFormError("");
    setConflicts([]);

    if (!selectedShift) {
      setFormError("Please select a shift.");
      return;
    }
    if (!fromDate || !toDate) {
      setFormError("Please select both from and to dates.");
      return;
    }
    if (!dayCount) {
      setFormError("To date cannot be earlier than from date.");
      return;
    }
    if (dayCount > 366) {
      setFormError("Date range cannot exceed 366 days.");
      return;
    }
    if (selectedIds.length === 0) {
      setFormError("Please select at least one employee.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await shiftService.assign({
        shiftId: Number(selectedShift.shiftId),
        fromDate,
        toDate,
        employeeIds: selectedIds,
        workDescription: workDescription.trim() || null,
      });

      const matchedEmployees = employees.filter((employee) =>
        selectedIds.includes(employee.id)
      );
      const optimistic = buildOptimisticRows(
        data?.batchId,
        matchedEmployees,
        selectedShift
      );
      setRows((current) => [...optimistic, ...current]);

      showToast(data?.message || "Shift assigned successfully.");
      setModalOpen(false);
      resetForm();

      await Promise.all([
        loadEmployees(),
        loadRows({ showLoader: false }),
      ]);
    } catch (err) {
      const body = err.response?.data;
      if (err.response?.status === 409) {
        setConflicts(Array.isArray(body?.conflicts) ? body.conflicts : []);
        setFormError(
          body?.message ||
            "Some selected employees already have a shift assigned on these dates."
        );
      } else {
        setFormError(
          body?.message || "Could not assign the shift. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await shiftService.removeAssignment(
        deleteTarget.batchId,
        deleteTarget.empId
      );
      showToast("Assignment entry removed.");
      setDeleteTarget(null);
      await Promise.all([loadRows(), loadEmployees()]);
    } catch (err) {
      showToast(
        err.response?.data?.message || "Could not remove this assignment.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  const rowActions = (row) => [
    {
      key: "view",
      label: "View / reassign",
      ariaLabel: `View or reassign ${row.employeeName}`,
      icon: VisibilityOutlined,
      onClick: () => openReassign(row),
    },
    {
      key: "delete",
      label: "Delete entry",
      ariaLabel: `Delete assignment for ${row.employeeName}`,
      icon: DeleteOutlineOutlined,
      tone: "danger",
      onClick: () => setDeleteTarget(row),
    },
  ];

  const columns = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => (
        <span className="sa-employee-cell">
          <span
            className="sa-avatar"
            style={{
              background: getAvatarGradient({
                id: row.empId,
                firstName: row.employeeName,
                employeeCode: row.employeeCode,
              }),
            }}
          >
            {getInitials(row.employeeName)}
          </span>
          <span className="sa-employee-copy">
            <strong>{row.employeeName || "—"}</strong>
            <small>
              {[row.employeeCode, row.departmentName].filter(Boolean).join(" · ") ||
                "No department"}
            </small>
          </span>
        </span>
      ),
    },
    {
      key: "shift",
      header: "Assigned Shift",
      render: (row) => {
        const palette = getShiftPalette(row);
        return (
          <span
            className="sa-shift-pill"
            style={{
              background: palette.soft,
              color: palette.dark,
              borderColor: `${palette.main}33`,
            }}
          >
            <span style={{ background: palette.main }} />
            {row.shiftName || "Shift"} • {timeText(row.startTime)}–
            {timeText(row.endTime)}
          </span>
        );
      },
    },
    {
      key: "dates",
      header: "Date Range",
      render: (row) => {
        const from = parseInputDate(row.fromDate);
        const to = parseInputDate(row.toDate);
        const days = dayCountOf(from, to);
        return (
          <span className="sa-date-cell">
            <span>
              {formatDate(row.fromDate)}
              {!isSameDay(row.fromDate, row.toDate)
                ? ` → ${formatDate(row.toDate)}`
                : ""}
            </span>
            <CountBadge value={`${days}d`} />
          </span>
        );
      },
    },
    {
      key: "work",
      header: "Work Description",
      render: (row) => (
        <span className="sa-work-cell">{row.workDescription || "—"}</span>
      ),
    },
    {
      key: "assignedBy",
      header: "Assigned By",
      render: (row) => (
        <span className="sa-assigned-cell">
          <strong>{row.createdByName || "Unknown"}</strong>
          <small>
            {roleLabel(row.createdByRole)} · {formatDateTime(row.createdAt)}
          </small>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => <RowActions actions={rowActions(row)} />,
    },
  ];

  const hasFilters = Boolean(search.trim()) || shiftFilter !== "all" || Boolean(departmentFilter);
  const emptyState = (
    <EmptyState
      title={hasFilters ? "No assignments found." : "No shift assignments yet."}
      subtitle={
        hasFilters
          ? "Try a different search, shift, or department."
          : "Use Assign Shift to create the first assignment."
      }
    />
  );

  return (
    <div className="dash-page admin-page-shell">
      <Sidebar
        activeKey="shift-assignments"
        onLogout={handleLogout}
        title="HRMS"
        user={user}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
      <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
        <Navbar
          userName={
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            "Admin"
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
              title="Shift Assign"
              subtitle="Assign shifts and audit employee assignment history"
              actions={[
                {
                  key: "refresh",
                  label: "Refresh",
                  icon: RefreshRounded,
                  onClick: loadAll,
                  disabled: loading,
                },
                {
                  key: "assign",
                  label: "Assign Shift",
                  icon: AddRounded,
                  variant: "primary",
                  onClick: openAssign,
                },
              ]}
            />

            {error && (
              <Alert severity="error" sx={{ borderRadius: "12px" }}>
                {error}
              </Alert>
            )}

            <div className="admin-toolbar sa-toolbar">
              <div className="admin-toolbar-left">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search employee, code, shift, assigned by..."
                  ariaLabel="Search assignments"
                />

                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="sa-shift-filter">Shift</InputLabel>
                  <Select
                    labelId="sa-shift-filter"
                    label="Shift"
                    value={shiftFilter}
                    onChange={(event) => setShiftFilter(event.target.value)}
                  >
                    <MenuItem value="all">All Shifts</MenuItem>
                    {shifts.map((shift) => (
                      <MenuItem key={shift.shiftId} value={String(shift.shiftId)}>
                        {shift.shiftName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="sa-department-filter">Department</InputLabel>
                  <Select
                    labelId="sa-department-filter"
                    label="Department"
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                  >
                    <MenuItem value="">All Departments</MenuItem>
                    {departments.map((department) => (
                      <MenuItem key={department} value={department}>
                        {department}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            </div>

            <DataTable
              ariaLabel="Shift assignment log"
              columns={columns}
              rows={pagedRows}
              rowKey={(row) => `${row.batchId}-${row.empId}`}
              loading={loading}
              skeletonRows={PAGE_SIZE}
              empty={emptyState}
            />

            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredRows.length}
              onPageChange={setPage}
            />

            <MobileCardList
              items={mobileRows}
              loading={loading}
              getKey={(row) => `${row.batchId}-${row.empId}`}
              hasMore={filteredRows.length > mobileVisible}
              onLoadMore={() =>
                setMobileVisible((current) => current + MOBILE_BATCH)
              }
              empty={emptyState}
              renderItem={(row) => {
                const from = parseInputDate(row.fromDate);
                const to = parseInputDate(row.toDate);
                return (
                  <MobileCard
                    title={row.employeeName || "Employee"}
                    subtitle={[row.employeeCode, row.departmentName]
                      .filter(Boolean)
                      .join(" · ")}
                    badge={
                      <span
                        className="sa-shift-pill"
                        style={{
                          background: getShiftPalette(row).soft,
                          color: getShiftPalette(row).dark,
                        }}
                      >
                        {row.shiftName}
                      </span>
                    }
                    fields={[
                      {
                        label: "Shift timing",
                        value: `${timeText(row.startTime)}–${timeText(
                          row.endTime
                        )}`,
                      },
                      {
                        label: "Date range",
                        value: `${formatDate(row.fromDate)} → ${formatDate(
                          row.toDate
                        )} (${dayCountOf(from, to)}d)`,
                      },
                      { label: "Work", value: row.workDescription || "—" },
                      {
                        label: "Assigned by",
                        value: `${row.createdByName || "Unknown"} · ${roleLabel(
                          row.createdByRole
                        )}`,
                      },
                    ]}
                    actions={rowActions(row)}
                    ariaLabel={`Assignment for ${row.employeeName}`}
                  />
                );
              }}
            />
          </div>
        </div>
      </div>

      <Dialog
        open={modalOpen}
        onClose={saving ? undefined : () => setModalOpen(false)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: "22px",
              maxWidth: "1080px",
              width: "100%",
              overflow: "hidden",
            },
          },
        }}
      >
        <div className="sa-modal-head">
          <div>
            <p>{editingRow ? "Reassign shift" : "New assignment"}</p>
            <h2>Assign Shift</h2>
          </div>
          <button
            type="button"
            className="sa-icon-btn"
            aria-label="Close assign shift dialog"
            onClick={() => setModalOpen(false)}
            disabled={saving}
          >
            <Close fontSize="small" />
          </button>
        </div>

        <DialogContent sx={{ p: 0 }}>
          <div className="sa-modal-grid">
            <section className="sa-panel sa-details">
              <form onSubmit={handleAssign}>
                <div className="sa-field">
                  <span className="sa-label">Select shift</span>
                  <div className="sa-shift-grid" role="group" aria-label="Select a shift">
                    {shifts.map((shift) => {
                      const palette = getShiftPalette(shift);
                      const active =
                        Number(selectedShiftId) === Number(shift.shiftId);

                      return (
                        <button
                          key={shift.shiftId}
                          type="button"
                          className={`sa-shift-card${active ? " is-active" : ""}`}
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedShiftId(shift.shiftId);
                            setFormError("");
                          }}
                        >
                          <span
                            className="sa-shift-dot"
                            style={{ background: palette.main }}
                          />
                          <span className="sa-shift-copy">
                            <strong>{shift.shiftName}</strong>
                            <small>
                              {timeText(shift.startTime)}–{timeText(shift.endTime)} ·{" "}
                              {Number(shift.durationHours)}h
                            </small>
                          </span>
                          {active && (
                            <CheckCircle
                              fontSize="small"
                              style={{ color: "#4f46e5" }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sa-field">
                  <div className="sa-label-row">
                    <span className="sa-label">Date range</span>
                    <div className="sa-presets">
                      {[
                        { key: "today", label: "Today" },
                        { key: "3days", label: "3 days" },
                        { key: "week", label: "7 days" },
                        { key: "month", label: "This month" },
                      ].map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          className="sa-preset"
                          onClick={() => applyPreset(preset.key)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sa-date-row">
                    <TextField
                      label="From date"
                      type="date"
                      size="small"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      label="To date"
                      type="date"
                      size="small"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </div>
                </div>

                <TextField
                  label="Work description"
                  size="small"
                  value={workDescription}
                  onChange={(event) => setWorkDescription(event.target.value)}
                  placeholder="Optional shift instructions or notes"
                  fullWidth
                />

                {formError && conflicts.length === 0 && (
                  <Alert severity="error" sx={{ borderRadius: "12px" }}>
                    {formError}
                  </Alert>
                )}

                {conflicts.length > 0 && (
                  <div className="sa-conflicts" role="alert">
                    <strong>{formError || `${conflicts.length} conflict(s)`}</strong>
                    <ul>
                      {conflicts.slice(0, 6).map((conflict, index) => {
                        const conflictDate =
                          conflict.shiftDate || conflict.date;
                        return (
                          <li
                            key={`${conflict.empId}-${conflictDate}-${index}`}
                          >
                            {conflict.employeeName ||
                              `Employee ${conflict.empId}`}{" "}
                            · {formatDate(conflictDate)} · already on{" "}
                            {conflict.existingShift}
                          </li>
                        );
                      })}
                      {conflicts.length > 6 && (
                        <li>+{conflicts.length - 6} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="sa-summary">
                  <span>
                    {selectedIds.length} employee
                    {selectedIds.length === 1 ? "" : "s"} × {dayCount} day
                    {dayCount === 1 ? "" : "s"}
                  </span>
                  <strong>{totalAssignments} assignments</strong>
                </div>

                <div className="sa-form-actions">
                  <button
                    type="submit"
                    className="admin-btn is-primary-solid"
                    disabled={saving || selectedIds.length === 0}
                  >
                    {saving ? "Assigning…" : "Assign shift"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn is-ghost-dark"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </section>

            <section className="sa-panel sa-employees">
              <header className="sa-employees-head">
                <div>
                  <h3>Select employees</h3>
                  <p>
                    {filteredEmployees.length} shown · {employees.length} active
                  </p>
                </div>
                <div className="sa-head-actions">
                  <button
                    type="button"
                    className="sa-link-btn"
                    onClick={selectShown}
                    disabled={filteredEmployees.length === 0}
                  >
                    Select shown
                  </button>
                  <button
                    type="button"
                    className="sa-link-btn"
                    onClick={() => setSelectedIds([])}
                    disabled={selectedIds.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </header>

              <div className="sa-emp-tabs" role="tablist" aria-label="Filter employees by current shift">
                {shiftTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={employeeTab === tab.key}
                    className={`sa-emp-tab${employeeTab === tab.key ? " is-active" : ""}`}
                    onClick={() => setEmployeeTab(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <strong>{tab.count}</strong>
                  </button>
                ))}
              </div>

              <div className="sa-emp-toolbar">
                <SearchInput
                  value={employeeSearch}
                  onChange={setEmployeeSearch}
                  placeholder="Search name, code, email..."
                  ariaLabel="Search employees"
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="sa-employee-department">Department</InputLabel>
                  <Select
                    labelId="sa-employee-department"
                    label="Department"
                    value={employeeDepartment}
                    onChange={(event) => setEmployeeDepartment(event.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {departments.map((department) => (
                      <MenuItem key={department} value={department}>
                        {department}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div className="sa-emp-list" role="group" aria-label="Select employees">
                {filteredEmployees.length === 0 ? (
                  <div className="sa-emp-empty">
                    <Groups />
                    <p>No employees match these filters.</p>
                  </div>
                ) : (
                  filteredEmployees.map((employee) => {
                    const selected = selectedSet.has(employee.id);
                    const currentShift = currentShiftOf(employee);

                    return (
                      <button
                        key={employee.id}
                        type="button"
                        className={`sa-emp-card${selected ? " is-selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleEmployee(employee.id)}
                      >
                        <span
                          className="sa-avatar"
                          style={{ background: getAvatarGradient(employee) }}
                        >
                          {getInitials(employeeName(employee))}
                        </span>
                        <span className="sa-emp-copy">
                          <strong>{employeeName(employee)}</strong>
                          <small>
                            {[employee.employeeCode, employee.departmentName]
                              .filter(Boolean)
                              .join(" · ") || "No department"}
                          </small>
                          <span
                            className={`sa-current-shift${currentShift ? "" : " is-unassigned"}`}
                          >
                            {currentShift ? currentShift.shiftName : "Unassigned"}
                          </span>
                        </span>
                        <span className="sa-check">
                          {selected ? (
                            <CheckCircle fontSize="small" />
                          ) : (
                            <RadioButtonUnchecked fontSize="small" />
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="sa-emp-foot">
                <span>
                  {selectedIds.length} of {employees.length} active employees selected
                </span>
                <CountBadge
                  value={filteredEmployees.length}
                  label="shown"
                  ariaLabel={`${filteredEmployees.length} employees shown`}
                />
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete assignment entry"
        message={
          deleteTarget
            ? `${deleteTarget.employeeName} ki ${deleteTarget.shiftName} assignment hat jayegi.`
            : "This assignment will be removed."
        }
        confirmLabel="Delete entry"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

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

export default ShiftAssign;
