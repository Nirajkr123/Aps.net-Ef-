import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Snackbar, Switch, TextField } from "@mui/material";
import {
  Add as AddIcon,
  EditOutlined,
  Refresh as RefreshIcon,
  ToggleOff,
  ToggleOn,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import "./ShiftManagement.css";
import shiftService from "../../services/shiftService";
import {
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
} from "../../components/admin";
import {
  ShiftTimeline,
  computeShiftWindow,
  getShiftPalette,
  timeText,
} from "./shiftUi";

const PAGE_SIZE = 10;
const MOBILE_BATCH = 5;

const blankForm = {
  shiftName: "",
  startTime: "06:00",
  durationHours: 10,
  isActive: true,
};

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDuration = (value) => {
  const hours = num(value);
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
};

function ShiftManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(0);
  const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

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

  const loadShifts = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const { data } = await shiftService.getAll();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Shifts load nahi ho payi. Phir try karein.");
      setToast({
        open: true,
        message: "Shifts load nahi ho payi. Phir try karein.",
        severity: "error",
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShifts({ showLoader: true });
  }, [loadShifts]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blankForm });
    setFormError("");
    setDrawerOpen(true);
  };

  const openEdit = (shift) => {
    setEditing(shift);
    setForm({
      shiftName: shift.shiftName || "",
      startTime: timeText(shift.startTime),
      durationHours: num(shift.durationHours, 10),
      isActive: Boolean(shift.isActive),
    });
    setFormError("");
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const name = form.shiftName.trim();
    const duration = Number(form.durationHours);

    if (!name) {
      setFormError("Shift name is required.");
      return;
    }
    if (!form.startTime) {
      setFormError("Start time is required.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration >= 24) {
      setFormError("Duration must be greater than 0 and less than 24 hours.");
      return;
    }

    setSaving(true);
    setFormError("");
    const payload = {
      shiftName: name,
      startTime: form.startTime,
      durationHours: duration,
      isActive: form.isActive,
    };

    try {
      if (editing) {
        await shiftService.update(editing.shiftId, payload);
        showToast("Shift updated.");
      } else {
        await shiftService.create(payload);
        showToast("Shift created.");
      }
      setDrawerOpen(false);
      await loadShifts({ showLoader: false });
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not save this shift.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (shift, isActive) => {
    try {
      await shiftService.setStatus(shift.shiftId, isActive);
      setShifts((current) =>
        current.map((item) =>
          item.shiftId === shift.shiftId ? { ...item, isActive } : item
        )
      );
      showToast(isActive ? "Shift activated." : "Shift deactivated.");
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update this shift.", "error");
    }
  };

  const searchedShifts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return shifts;
    return shifts.filter((shift) => {
      const palette = getShiftPalette(shift);
      return (
        String(shift.shiftName || "").toLowerCase().includes(query) ||
        palette.name.toLowerCase().includes(query) ||
        timeText(shift.startTime).includes(query) ||
        timeText(shift.endTime).includes(query)
      );
    });
  }, [shifts, search]);

  const counts = useMemo(
    () => ({
      all: searchedShifts.length,
      active: searchedShifts.filter((shift) => shift.isActive).length,
      inactive: searchedShifts.filter((shift) => !shift.isActive).length,
      overnight: searchedShifts.filter((shift) => shift.crossesMidnight).length,
    }),
    [searchedShifts]
  );

  const filteredShifts = useMemo(() => {
    if (statusFilter === "all") return searchedShifts;
    if (statusFilter === "active") return searchedShifts.filter((shift) => shift.isActive);
    if (statusFilter === "inactive") {
      return searchedShifts.filter((shift) => !shift.isActive);
    }
    return searchedShifts.filter((shift) => shift.crossesMidnight);
  }, [searchedShifts, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredShifts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedShifts = filteredShifts.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  const mobileShifts = filteredShifts.slice(0, mobileVisible);

  const preview = computeShiftWindow(form.startTime, form.durationHours);
  const formPalette = getShiftPalette({
    startTime: form.startTime,
    crossesMidnight: preview.crossesMidnight,
  });

  const shiftActions = (shift) => [
    {
      key: "toggle",
      label: shift.isActive ? "Deactivate" : "Activate",
      ariaLabel: `${shift.isActive ? "Deactivate" : "Activate"} ${shift.shiftName}`,
      icon: shift.isActive ? ToggleOn : ToggleOff,
      onClick: () => toggleActive(shift, !shift.isActive),
    },
    {
      key: "edit",
      label: "Edit",
      ariaLabel: `Edit ${shift.shiftName}`,
      icon: EditOutlined,
      onClick: () => openEdit(shift),
    },
  ];

  const columns = [
    {
      key: "shiftName",
      header: "Shift",
      render: (shift) => {
        const palette = getShiftPalette(shift);
        return (
          <>
            <span className="admin-cell-primary">{shift.shiftName}</span>
            <span className="admin-cell-sub">
              {palette.name} shift
              {shift.crossesMidnight ? " · crosses midnight" : ""}
            </span>
          </>
        );
      },
    },
    {
      key: "window",
      header: "Window",
      width: 260,
      render: (shift) => {
        const palette = getShiftPalette(shift);
        return (
          <div className="shift-window">
            <span className="shift-window-time">
              {timeText(shift.startTime)}
              <span className="shift-arrow" aria-hidden="true">
                →
              </span>
              {timeText(shift.endTime)}
            </span>
            <ShiftTimeline shift={shift} palette={palette} />
          </div>
        );
      },
    },
    {
      key: "duration",
      header: "Duration",
      render: (shift) => formatDuration(shift.durationHours),
    },
    {
      key: "status",
      header: "Status",
      render: (shift) => (
        <StatusBadge status={shift.isActive ? "Active" : "Inactive"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (shift) => <RowActions actions={shiftActions(shift)} />,
    },
  ];

  const hasFilters = Boolean(search.trim()) || statusFilter !== "all";
  const emptyState = error ? (
    <EmptyState
      title="Shifts load nahi ho payi."
      subtitle={error}
      action={
        <button
          type="button"
          className="admin-btn is-primary-solid"
          onClick={() => loadShifts({ showLoader: true })}
        >
          Try again
        </button>
      }
    />
  ) : (
    <EmptyState
      title={hasFilters ? "Koi shift nahi mili." : "Abhi koi shift nahi hai."}
      subtitle={
        hasFilters
          ? "Search ya filter badal kar try karein."
          : "Pehli shift window banayein taaki employees assign kar sakein."
      }
      action={
        !hasFilters ? (
          <button type="button" className="admin-btn is-primary-solid" onClick={openCreate}>
            Add Shift
          </button>
        ) : null
      }
    />
  );

  return (
    <div className="dash-page admin-page-shell">
      <Sidebar
        activeKey="shifts"
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
          <div className="admin-page">
            <PageHeader
              title="Shifts"
              subtitle="Design shift windows and keep them assignable"
              actions={[
                {
                  key: "refresh",
                  label: "Refresh",
                  icon: RefreshIcon,
                  onClick: () => loadShifts({ showLoader: true }),
                  disabled: loading,
                },
                {
                  key: "add",
                  label: "Add Shift",
                  icon: AddIcon,
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
                  placeholder="Search by name or time..."
                  ariaLabel="Search shifts"
                />
              </div>
              <div className="admin-toolbar-right">
                <FilterPills
                  ariaLabel="Filter shifts"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { key: "all", label: "All", count: counts.all },
                    { key: "active", label: "Active", count: counts.active },
                    { key: "inactive", label: "Inactive", count: counts.inactive },
                    { key: "overnight", label: "Overnight", count: counts.overnight },
                  ]}
                />
              </div>
            </div>

            <DataTable
              ariaLabel="Shifts"
              columns={columns}
              rows={pagedShifts}
              rowKey="shiftId"
              loading={loading}
              skeletonRows={PAGE_SIZE}
              empty={emptyState}
            />

            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredShifts.length}
              onPageChange={setPage}
            />

            <MobileCardList
              items={mobileShifts}
              loading={loading}
              getKey={(shift) => shift.shiftId}
              hasMore={filteredShifts.length > mobileVisible}
              onLoadMore={() => setMobileVisible((prev) => prev + MOBILE_BATCH)}
              empty={emptyState}
              renderItem={(shift) => {
                const palette = getShiftPalette(shift);
                return (
                  <MobileCard
                    title={shift.shiftName}
                    subtitle={`${palette.name} shift${
                      shift.crossesMidnight ? " · crosses midnight" : ""
                    }`}
                    badge={
                      <StatusBadge status={shift.isActive ? "Active" : "Inactive"} />
                    }
                    fields={[
                      {
                        label: "Window",
                        value: `${timeText(shift.startTime)} → ${timeText(
                          shift.endTime
                        )}`,
                      },
                      { label: "Duration", value: formatDuration(shift.durationHours) },
                    ]}
                    actions={shiftActions(shift)}
                    ariaLabel={`${shift.shiftName} shift`}
                  />
                );
              }}
            />
          </div>
        </div>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={editing ? "Edit Shift" : "Add Shift"}
        submitLabel={editing ? "Update shift" : "Create shift"}
        saving={saving}
        error={formError}
        onClose={() => {
          if (!saving) setDrawerOpen(false);
        }}
        onSubmit={handleSave}
      >
        <div className="admin-form">
          <TextField
            label="Shift name"
            value={form.shiftName}
            onChange={(event) =>
              setForm((current) => ({ ...current, shiftName: event.target.value }))
            }
            placeholder="e.g. Shift A"
            fullWidth
            size="small"
            autoFocus
          />

          <div className="admin-form-row">
            <TextField
              label="Start time"
              type="time"
              value={form.startTime}
              onChange={(event) =>
                setForm((current) => ({ ...current, startTime: event.target.value }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              size="small"
            />
            <TextField
              label="Duration (hours)"
              type="number"
              value={form.durationHours}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  durationHours: event.target.value,
                }))
              }
              slotProps={{ htmlInput: { min: 0.5, max: 23.5, step: 0.5 } }}
              fullWidth
              size="small"
            />
          </div>

          <div
            className="shift-preview"
            style={{
              borderColor: `${formPalette.main}33`,
              background: `linear-gradient(135deg, #ffffff, ${formPalette.soft})`,
            }}
          >
            <div className="shift-preview-head">
              <span
                className="shift-preview-label"
                style={{ color: formPalette.dark }}
              >
                Live preview
              </span>
              <span
                className="shift-preview-type"
                style={{ background: formPalette.soft, color: formPalette.dark }}
              >
                {formPalette.name}
              </span>
            </div>
            <p className="shift-preview-time">
              {preview.start}{" "}
              <span className="shift-arrow" aria-hidden="true">
                →
              </span>{" "}
              {preview.end}
            </p>
            <p className="shift-preview-meta">
              {preview.duration}h {preview.crossesMidnight ? "· ends next day" : "· same day"}
            </p>
            <div className="shift-preview-timeline">
              <ShiftTimeline
                shift={{ startTime: form.startTime, durationHours: form.durationHours }}
                palette={formPalette}
                showLabels
              />
            </div>
          </div>

          <div className="shift-active-row">
            <div className="shift-active-copy">
              <h4>Available for assignment</h4>
              <p>Inactive shifts catalog mein rehti hain par assign nahi hoti.</p>
            </div>
            <Switch
              checked={Boolean(form.isActive)}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              slotProps={{ input: { "aria-label": "Shift active" } }}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: formPalette.main },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  bgcolor: formPalette.main,
                },
              }}
            />
          </div>
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

export default ShiftManagement;
