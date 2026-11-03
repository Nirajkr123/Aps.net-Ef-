import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AssignmentTurnedIn,
  AutoAwesome,
  CancelOutlined,
  CheckCircle,
  ClearAll,
  Close,
  DoneAll,
  EventRepeat,
  Groups,
  Refresh,
  Search,
  Visibility,
  WarningAmber,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import shiftService from "../../services/shiftService";
import employeeServ from "../../services/employeeService";
import {
  ShiftHero,
  ShiftStatCard,
  ShiftTimeline,
  formatDate,
  formatDateTime,
  getAvatarGradient,
  getInitials,
  getShiftPalette,
  gradientButtonSx,
  heroButtonSx,
  heroSolidButtonSx,
  timeText,
  toInputDate,
} from "./shiftUi";

const todayInput = () => toInputDate(new Date());

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

const employeeName = (employee) =>
  [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
  employee?.email ||
  "Employee";

const initialForm = () => ({
  shiftId: "",
  fromDate: todayInput(),
  toDate: todayInput(),
  workDescription: "",
});

function PreviewMetric({ label, value, color }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        px: 1.25,
        py: 1,
        bgcolor: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(255,255,255,0.9)",
        boxShadow: "0 10px 22px -22px rgba(30,41,59,0.6)",
      }}
    >
      <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, display: "block" }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900, color, fontSize: 18, lineHeight: 1.15 }}>
        {value}
      </Typography>
    </Box>
  );
}

function BulkShiftAssignment() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [selectedIds, setSelectedIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const [viewOpen, setViewOpen] = useState(false);
  const [viewBatch, setViewBatch] = useState(null);
  const [viewAssignments, setViewAssignments] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);

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

  const showToast = (message, severity = "success") =>
    setToast({ open: true, message, severity });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shiftRes, employeeRes, batchRes] = await Promise.all([
        shiftService.getActive(),
        employeeServ.getAll({ status: "Active" }),
        shiftService.getBatches(),
      ]);
      setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : []);
      setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
      setBatches(Array.isArray(batchRes.data) ? batchRes.data : []);
    } catch (err) {
      console.error("Load shift assignment data error:", err);
      setError("Could not load shift assignment data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBatches = useCallback(async () => {
    try {
      const { data } = await shiftService.getBatches();
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load assignment batches error:", err);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(employees.map((employee) => employee.departmentName).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right)),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      const departmentMatch =
        !departmentFilter || employee.departmentName === departmentFilter;
      if (!departmentMatch) return false;
      if (!query) return true;
      const haystack = [
        employeeName(employee),
        employee.employeeCode,
        employee.email,
        employee.departmentName,
        employee.designationTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, employeeSearch, departmentFilter]);

  const dayCount = useMemo(() => {
    const from = parseInputDate(form.fromDate);
    const to = parseInputDate(form.toDate);
    if (!from || !to || to < from) return 0;
    return Math.round((to - from) / 86400000) + 1;
  }, [form.fromDate, form.toDate]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const totalAssignments = selectedIds.length * dayCount;
  const selectedShift = shifts.find((shift) => shift.shiftId === Number(form.shiftId));
  const selectedShiftPalette = getShiftPalette(selectedShift);
  const activeBatches = batches.filter((batch) => batch.status === "Active").length;
  const totalAssignmentsInBatches = batches.reduce(
    (sum, batch) => sum + Number(batch.assignmentCount || 0),
    0
  );
  const selectionPercent = employees.length
    ? Math.round((selectedIds.length / employees.length) * 100)
    : 0;

  const toggleEmployee = (employeeId) => {
    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredEmployees.forEach((employee) => next.add(employee.id));
      return Array.from(next);
    });
  };

  const clearSelection = () => setSelectedIds([]);

  const resetForm = () => {
    setForm(initialForm());
    setSelectedIds([]);
    setEmployeeSearch("");
    setDepartmentFilter("");
    setFormError("");
    setConflicts([]);
  };

  const applyDatePreset = (preset) => {
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
    setForm((current) => ({
      ...current,
      fromDate: toInputDate(from),
      toDate: toInputDate(to),
    }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setFormError("");
    setConflicts([]);

    if (!form.shiftId) {
      setFormError("Please select a shift.");
      return;
    }
    if (!form.fromDate || !form.toDate) {
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
    if (selectedIds.length > 1000) {
      setFormError("A maximum of 1000 employees can be assigned at once.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await shiftService.bulkAssign({
        shiftId: Number(form.shiftId),
        fromDate: form.fromDate,
        toDate: form.toDate,
        employeeIds: selectedIds,
        workDescription: form.workDescription.trim() || null,
      });
      showToast(data?.message || "Shift assigned successfully.");
      resetForm();
      await loadBatches();
    } catch (err) {
      console.error("Bulk assign error:", err);
      const body = err.response?.data;
      if (err.response?.status === 409) {
        setConflicts(Array.isArray(body?.conflicts) ? body.conflicts : []);
        setFormError(
          body?.message || "Some selected employees already have a shift assigned on these dates."
        );
      } else {
        setFormError(body?.message || "Could not assign the shift. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const openBatch = async (batch) => {
    setViewBatch(batch);
    setViewOpen(true);
    setViewLoading(true);
    setViewAssignments([]);
    try {
      const { data } = await shiftService.getBatchAssignments(batch.batchId);
      setViewAssignments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load batch assignments error:", err);
      showToast("Could not load this batch.", "error");
    } finally {
      setViewLoading(false);
    }
  };

  const cancelBatch = async (batch) => {
    if (!window.confirm(`Cancel this shift assignment batch (#${batch.batchId})?`)) return;
    setCancelingId(batch.batchId);
    try {
      await shiftService.cancelBatch(batch.batchId);
      showToast("Assignment batch cancelled.");
      await loadBatches();
      if (viewOpen && viewBatch?.batchId === batch.batchId) {
        setViewOpen(false);
        setViewBatch(null);
      }
    } catch (err) {
      console.error("Cancel batch error:", err);
      showToast(err.response?.data?.message || "Could not cancel this batch.", "error");
    } finally {
      setCancelingId(null);
    }
  };

  const viewPalette = getShiftPalette(
    shifts.find((shift) => shift.shiftId === viewBatch?.shiftId)
  );

  return (
    <div className="dash-page">
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
          userName={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin"}
          userRole={user?.role || "OWNER"}
          user={user}
          onLogout={handleLogout}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed(!collapsed)}
        />
        <div className="dash-content">
          <ShiftHero
            eyebrow="Schedule operations"
            title="Shift Assignment Lab"
            subtitle="Build a batch, watch the live preview, and roll shifts out to your whole team in one colorful sweep."
            icon={EventRepeat}
            gradient="linear-gradient(135deg, #667eea 0%, #6366f1 38%, #764ba2 100%)"
            stats={[
              { label: "Batches", value: batches.length },
              { label: "Active", value: activeBatches },
              { label: "Assignments", value: totalAssignmentsInBatches },
            ]}
            actions={
              <>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadAll}
                  disabled={loading}
                  sx={heroButtonSx}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  startIcon={<EventRepeat />}
                  onClick={() => navigate("/shifts")}
                  sx={heroSolidButtonSx}
                >
                  Manage shifts
                </Button>
              </>
            }
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
              gap: 1.5,
              mt: 2.5,
              mb: 2.5,
            }}
          >
            <ShiftStatCard
              label="Total batches"
              value={batches.length}
              hint="All assignment runs"
              icon={AssignmentTurnedIn}
              color="#6366f1"
              bg="#eef2ff"
            />
            <ShiftStatCard
              label="Active batches"
              value={activeBatches}
              hint="Currently scheduled"
              icon={CheckCircle}
              color="#059669"
              bg="#ecfdf5"
            />
            <ShiftStatCard
              label="Assignments"
              value={totalAssignmentsInBatches}
              hint="Employee-day rows"
              icon={EventRepeat}
              color="#f43f5e"
              bg="#fff1f2"
            />
            <ShiftStatCard
              label="Active people"
              value={employees.length}
              hint="Available to assign"
              icon={Groups}
              color="#3b82f6"
              bg="#eff6ff"
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                textAlign: "center",
                borderRadius: 4,
                border: "1px solid #eef0f6",
                background: "linear-gradient(150deg, #ffffff, #eef2ff)",
              }}
            >
              <CircularProgress size={30} />
              <Typography variant="body2" sx={{ color: "#64748b", mt: 1 }}>
                Loading shifts, employees and batches...
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(0, 1.15fr)" },
                gap: 2.5,
                alignItems: "start",
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  overflow: "hidden",
                  borderRadius: 3.5,
                  border: "1px solid #eef0f6",
                  boxShadow: "0 22px 46px -38px rgba(99,102,241,0.8)",
                }}
              >
                <Box
                  sx={{
                    height: 5,
                    background: selectedShift
                      ? selectedShiftPalette.gradient
                      : "linear-gradient(90deg, #6366f1, #f43f5e)",
                  }}
                />
                <Box sx={{ p: 2.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        background: selectedShift
                          ? selectedShiftPalette.gradient
                          : "linear-gradient(135deg, #6366f1, #f43f5e)",
                        boxShadow: `0 12px 22px -14px ${selectedShiftPalette.glow}`,
                      }}
                    >
                      <AssignmentTurnedIn fontSize="small" />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                        Assignment details
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        Pick a shift, dates and an optional work note.
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      "& .MuiOutlinedInput-root": { borderRadius: 2.5 },
                    }}
                  >
                    {formError && conflicts.length === 0 && (
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {formError}
                      </Alert>
                    )}

                    {conflicts.length > 0 && (
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          border: "1px solid #fcd34d",
                          background: "linear-gradient(135deg, #fffbeb, #fff7ed)",
                        }}
                      >
                        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                          <WarningAmber sx={{ color: "#d97706", fontSize: 21, mt: 0.15 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 900, color: "#92400e" }}>
                              {formError || `${conflicts.length} conflict(s) found`}
                            </Typography>
                            <Box sx={{ maxHeight: 150, overflow: "auto", mt: 0.5, pr: 0.5 }}>
                              {conflicts.slice(0, 25).map((conflict, index) => (
                                <Typography
                                  key={`${conflict.empId}-${conflict.shiftDate}-${index}`}
                                  variant="caption"
                                  display="block"
                                  sx={{ color: "#a16207" }}
                                >
                                  {conflict.employeeName || `Employee ${conflict.empId}`} ·{" "}
                                  {formatDate(conflict.shiftDate)} · already on{" "}
                                  {conflict.existingShift}
                                </Typography>
                              ))}
                              {conflicts.length > 25 && (
                                <Typography
                                  variant="caption"
                                  display="block"
                                  sx={{ mt: 0.5, color: "#a16207", fontWeight: 700 }}
                                >
                                  +{conflicts.length - 25} more...
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    )}

                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: "#64748b", fontWeight: 900, letterSpacing: 0.6 }}
                      >
                        SELECT SHIFT
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                          gap: 1.25,
                          mt: 0.75,
                        }}
                      >
                        {shifts.length === 0 ? (
                          <Alert severity="info" sx={{ borderRadius: 2, gridColumn: "1 / -1" }}>
                            No active shifts.{" "}
                            <Button
                              size="small"
                              onClick={() => navigate("/shifts")}
                              sx={{ textTransform: "none", fontWeight: 800 }}
                            >
                              Manage shifts
                            </Button>
                          </Alert>
                        ) : (
                          shifts.map((shift) => {
                            const palette = getShiftPalette(shift);
                            const selected = Number(form.shiftId) === shift.shiftId;
                            const selectShift = () =>
                              setForm((current) => ({ ...current, shiftId: shift.shiftId }));
                            return (
                              <Box
                                key={shift.shiftId}
                                role="button"
                                tabIndex={0}
                                onClick={selectShift}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    selectShift();
                                  }
                                }}
                                sx={{
                                  position: "relative",
                                  cursor: "pointer",
                                  p: 1.5,
                                  borderRadius: 2.5,
                                  border: "2px solid",
                                  borderColor: selected ? palette.main : "#e2e8f0",
                                  background: selected
                                    ? `linear-gradient(135deg, #ffffff, ${palette.soft})`
                                    : "#fff",
                                  transition:
                                    "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
                                  boxShadow: selected
                                    ? `0 16px 30px -26px ${palette.main}`
                                    : "none",
                                  "&:hover": {
                                    transform: "translateY(-2px)",
                                    borderColor: palette.main,
                                    boxShadow: `0 16px 30px -26px ${palette.glow}`,
                                  },
                                }}
                              >
                                {selected && (
                                  <CheckCircle
                                    sx={{ position: "absolute", top: 7, right: 7, color: palette.main, fontSize: 18 }}
                                  />
                                )}
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, pr: 2 }}>
                                  <Box
                                    sx={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 2,
                                      flexShrink: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#fff",
                                      background: palette.gradient,
                                    }}
                                  >
                                    <EventRepeat sx={{ fontSize: 18 }} />
                                  </Box>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 900,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {shift.shiftName}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: "#64748b",
                                        display: "block",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {timeText(shift.startTime)}–{timeText(shift.endTime)} ·{" "}
                                      {Number(shift.durationHours)}h
                                    </Typography>
                                  </Box>
                                </Box>
                                <Box sx={{ mt: 1.1 }}>
                                  <ShiftTimeline shift={shift} palette={palette} height={6} />
                                </Box>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Box>

                    <Box>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          flexWrap: "wrap",
                          mb: 0.75,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ color: "#64748b", fontWeight: 900, letterSpacing: 0.6 }}
                        >
                          DATE RANGE
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {[
                            { key: "today", label: "Today" },
                            { key: "3days", label: "3 days" },
                            { key: "week", label: "7 days" },
                            { key: "month", label: "This month" },
                          ].map((preset) => (
                            <Chip
                              key={preset.key}
                              label={preset.label}
                              size="small"
                              clickable
                              onClick={() => applyDatePreset(preset.key)}
                              sx={{
                                height: 22,
                                fontSize: 11,
                                fontWeight: 800,
                                bgcolor: "#f1f5f9",
                                color: "#475569",
                                "&:hover": { bgcolor: "#eef2ff", color: "#6366f1" },
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                          gap: 2,
                        }}
                      >
                        <TextField
                          label="From date"
                          type="date"
                          value={form.fromDate}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, fromDate: event.target.value }))
                          }
                          required
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="To date"
                          type="date"
                          value={form.toDate}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, toDate: event.target.value }))
                          }
                          required
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Box>
                    </Box>

                    <TextField
                      label="Work description"
                      value={form.workDescription}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          workDescription: event.target.value,
                        }))
                      }
                      placeholder="Optional - e.g. Night shift coverage"
                      multiline
                      minRows={2}
                      fullWidth
                    />

                    <Box
                      sx={{
                        p: 1.75,
                        borderRadius: 3,
                        border: `1px solid ${selectedShiftPalette.main}33`,
                        background: `linear-gradient(135deg, #ffffff, ${selectedShiftPalette.soft})`,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ color: selectedShiftPalette.dark, fontWeight: 900, letterSpacing: 0.6 }}
                        >
                          ASSIGNMENT PREVIEW
                        </Typography>
                        <Chip
                          label={`${totalAssignments} rows`}
                          size="small"
                          sx={{
                            height: 22,
                            fontWeight: 800,
                            bgcolor: selectedShiftPalette.soft,
                            color: selectedShiftPalette.dark,
                          }}
                        />
                      </Box>
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}>
                        <PreviewMetric label="Employees" value={selectedIds.length} color="#6366f1" />
                        <PreviewMetric label="Days" value={dayCount} color="#3b82f6" />
                        <PreviewMetric label="Assignments" value={totalAssignments} color="#f43f5e" />
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={saving}
                        startIcon={saving ? undefined : <AutoAwesome />}
                        sx={gradientButtonSx(selectedShiftPalette)}
                      >
                        {saving ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          "Assign shift"
                        )}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={resetForm}
                        disabled={saving}
                        sx={{
                          textTransform: "none",
                          fontWeight: 800,
                          borderRadius: 2.5,
                          borderColor: "#e2e8f0",
                          color: "#64748b",
                          "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" },
                        }}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  overflow: "hidden",
                  borderRadius: 3.5,
                  border: "1px solid #eef0f6",
                  boxShadow: "0 22px 46px -38px rgba(14,165,233,0.8)",
                }}
              >
                <Box sx={{ height: 5, background: "linear-gradient(90deg, #3b82f6, #f43f5e)" }} />
                <Box sx={{ p: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 1,
                      mb: 1.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          background: "linear-gradient(135deg, #3b82f6, #f43f5e)",
                          boxShadow: "0 12px 22px -14px rgba(14,165,233,0.7)",
                        }}
                      >
                        <Groups fontSize="small" />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                          Select employees
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>
                          {employees.length} active people available
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        startIcon={<DoneAll />}
                        onClick={selectAllFiltered}
                        sx={{ textTransform: "none", fontWeight: 800, color: "#6366f1" }}
                      >
                        Select shown
                      </Button>
                      <Button
                        size="small"
                        startIcon={<ClearAll />}
                        onClick={clearSelection}
                        disabled={selectedIds.length === 0}
                        sx={{ textTransform: "none", fontWeight: 800, color: "#64748b" }}
                      >
                        Clear
                      </Button>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 180px" },
                      gap: 1,
                      mb: 1.5,
                    }}
                  >
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Search name, code, email, department..."
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: "#94a3b8", fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      select
                      size="small"
                      label="Department"
                      value={departmentFilter}
                      onChange={(event) => setDepartmentFilter(event.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    >
                      <MenuItem value="">All departments</MenuItem>
                      {departments.map((department) => (
                        <MenuItem key={department} value={department}>
                          {department}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                        Selection progress
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#6366f1", fontWeight: 900 }}>
                        {selectionPercent}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={selectionPercent}
                      sx={{
                        height: 8,
                        borderRadius: 99,
                        bgcolor: "#eef2ff",
                        "& .MuiLinearProgress-bar": {
                          borderRadius: 99,
                          background: "linear-gradient(90deg, #6366f1, #f43f5e)",
                        },
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      maxHeight: 430,
                      overflow: "auto",
                      pr: 0.5,
                      "&::-webkit-scrollbar": { width: 6 },
                      "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: 99 },
                    }}
                  >
                    {filteredEmployees.length === 0 ? (
                      <Box
                        sx={{
                          p: 4,
                          textAlign: "center",
                          color: "#94a3b8",
                          border: "1px dashed #e2e8f0",
                          borderRadius: 3,
                        }}
                      >
                        <Groups sx={{ fontSize: 36, color: "#cbd5e1", mb: 0.5 }} />
                        <Typography variant="body2">
                          {employees.length === 0
                            ? "No active employees found."
                            : "No employees match your filters."}
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                          gap: 1,
                        }}
                      >
                        {filteredEmployees.map((employee) => {
                          const selected = selectedSet.has(employee.id);
                          const gradient = getAvatarGradient(employee);
                          return (
                            <Box
                              key={employee.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleEmployee(employee.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  toggleEmployee(employee.id);
                                }
                              }}
                              sx={{
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 1.1,
                                p: 1.1,
                                borderRadius: 2.5,
                                border: "1.5px solid",
                                borderColor: selected ? "#6366f1" : "#eef1f6",
                                background: selected
                                  ? "linear-gradient(135deg, #eef2ff, #fdf2f8)"
                                  : "#fff",
                                transition:
                                  "border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
                                "&:hover": {
                                  borderColor: "#c7d2fe",
                                  transform: "translateY(-2px)",
                                  boxShadow: "0 12px 24px -22px #6366f1",
                                },
                              }}
                            >
                              <Avatar
                                sx={{
                                  width: 38,
                                  height: 38,
                                  background: gradient,
                                  fontSize: 13,
                                  fontWeight: 900,
                                  boxShadow: "0 8px 16px -12px rgba(15,23,42,0.7)",
                                }}
                              >
                                {getInitials(employeeName(employee))}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 800,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {employeeName(employee)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#64748b",
                                    display: "block",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {[employee.employeeCode, employee.departmentName]
                                    .filter(Boolean)
                                    .join(" · ") || "No department"}
                                </Typography>
                              </Box>
                              <Checkbox
                                size="small"
                                checked={selected}
                                onChange={() => toggleEmployee(employee.id)}
                                onClick={(event) => event.stopPropagation()}
                                sx={{
                                  color: "#cbd5e1",
                                  "&.Mui-checked": { color: "#6366f1" },
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      mt: 1.5,
                      p: 1.25,
                      borderRadius: 2.5,
                      bgcolor: "#f8faff",
                      border: "1px solid #e0e7ff",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                      {selectedIds.length} of {employees.length} active employees selected
                    </Typography>
                    <Chip
                      label={`${filteredEmployees.length} shown`}
                      size="small"
                      sx={{ height: 22, bgcolor: "#eef2ff", color: "#6366f1", fontWeight: 800 }}
                    />
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}

          <Paper
            elevation={0}
            sx={{
              mt: 4,
              overflow: "hidden",
              borderRadius: 3.5,
              border: "1px solid #eef0f6",
              boxShadow: "0 22px 46px -38px rgba(99,102,241,0.8)",
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.75,
                display: "flex",
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.25,
                background: "linear-gradient(135deg, #eef2ff, #fdf2f8)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    background: "linear-gradient(135deg, #6366f1, #f43f5e)",
                    boxShadow: "0 12px 22px -14px rgba(99,102,241,0.7)",
                  }}
                >
                  <AssignmentTurnedIn fontSize="small" />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                    Assignment batches
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748b" }}>
                    {batches.length} total · {activeBatches} active
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                onClick={loadBatches}
                sx={{
                  textTransform: "none",
                  fontWeight: 800,
                  borderRadius: 2,
                  borderColor: "#c7d2fe",
                  color: "#6366f1",
                  bgcolor: "#fff",
                  "&:hover": { borderColor: "#a5b4fc", bgcolor: "#f8faff" },
                }}
              >
                Refresh batches
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor: "#f8fafc",
                      "& th": {
                        fontWeight: 900,
                        color: "#475569",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      },
                    }}
                  >
                    <TableCell>Batch</TableCell>
                    <TableCell>Shift</TableCell>
                    <TableCell>Dates</TableCell>
                    <TableCell>Employees</TableCell>
                    <TableCell>Assignments</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batches.map((batch) => {
                    const sameDay =
                      String(batch.fromDate).slice(0, 10) === String(batch.toDate).slice(0, 10);
                    const active = batch.status === "Active";
                    return (
                      <TableRow
                        key={batch.batchId}
                        hover
                        sx={{ "&:hover": { bgcolor: "#f8faff" }, "& td": { py: 1.25 } }}
                      >
                        <TableCell>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: 2,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 900,
                              background: "linear-gradient(135deg, #6366f1, #f43f5e)",
                            }}
                          >
                            #{batch.batchId}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {batch.shiftName || "—"}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                            Shift batch
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12 }}>
                            {formatDate(batch.fromDate)}
                          </Typography>
                          {!sameDay && (
                            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                              to {formatDate(batch.toDate)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={batch.totalEmployees}
                            size="small"
                            sx={{ height: 22, bgcolor: "#eef2ff", color: "#6366f1", fontWeight: 900 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {batch.assignmentCount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={batch.status}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              bgcolor: active ? "#ecfdf5" : "#f1f5f9",
                              color: active ? "#047857" : "#64748b",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" display="block" sx={{ fontWeight: 700 }}>
                            {formatDateTime(batch.createdAt)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                            by {batch.createdByName || "Unknown"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <Tooltip title="View assignments">
                            <IconButton
                              size="small"
                              onClick={() => openBatch(batch)}
                              sx={{
                                bgcolor: "#eef2ff",
                                color: "#6366f1",
                                "&:hover": { bgcolor: "#e0e7ff" },
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {active && (
                            <Tooltip title="Cancel batch">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={cancelingId === batch.batchId}
                                  onClick={() => cancelBatch(batch)}
                                  sx={{
                                    ml: 0.5,
                                    color: "#ef4444",
                                    "&:hover": { bgcolor: "#fef2f2" },
                                  }}
                                >
                                  {cancelingId === batch.batchId ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <CancelOutlined fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {batches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                        <AssignmentTurnedIn sx={{ fontSize: 38, color: "#cbd5e1", mb: 0.5 }} />
                        <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 700 }}>
                          No assignment batches yet
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                          Assign a shift above to create the first batch.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </div>
      </div>

      <Dialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              px: 3,
              py: 2.25,
              color: "#fff",
              background: viewPalette.hero,
              "&::after": {
                content: '""',
                position: "absolute",
                width: 170,
                height: 170,
                borderRadius: "50%",
                top: -90,
                right: -40,
                background: "rgba(255,255,255,0.14)",
              },
            }}
          >
            <Box sx={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 1.25, pr: 5 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.32)",
                }}
              >
                <AssignmentTurnedIn />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" sx={{ opacity: 0.78, fontWeight: 700, letterSpacing: 1.4 }}>
                  Assignment batch
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 20, lineHeight: 1.15 }} noWrap>
                  #{viewBatch?.batchId} · {viewBatch?.shiftName || "Shift"}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setViewOpen(false)}
              sx={{ position: "absolute", right: 8, top: 8, color: "#fff", zIndex: 2 }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2.5 }}>
          {viewBatch && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" },
                gap: 1,
                mb: 2,
              }}
            >
              <PreviewMetric
                label="Date range"
                value={
                  String(viewBatch.fromDate).slice(0, 10) === String(viewBatch.toDate).slice(0, 10)
                    ? formatDate(viewBatch.fromDate)
                    : `${formatDate(viewBatch.fromDate)} → ${formatDate(viewBatch.toDate)}`
                }
                color="#6366f1"
              />
              <PreviewMetric label="Employees" value={viewBatch.totalEmployees} color="#3b82f6" />
              <PreviewMetric label="Assignments" value={viewBatch.assignmentCount} color="#f43f5e" />
              <PreviewMetric label="Status" value={viewBatch.status} color="#059669" />
            </Box>
          )}
          {viewBatch?.workDescription && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                mb: 2,
                bgcolor: "#fffbeb",
                border: "1px solid #fde68a",
              }}
            >
              <Typography variant="caption" sx={{ color: "#92400e", fontWeight: 900 }}>
                WORK DESCRIPTION
              </Typography>
              <Typography variant="body2" sx={{ color: "#78350f" }}>
                {viewBatch.workDescription}
              </Typography>
            </Box>
          )}

          {viewLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2.5, overflow: "hidden" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor: "#f8fafc",
                      "& th": {
                        fontWeight: 900,
                        color: "#475569",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      },
                    }}
                  >
                    <TableCell>Employee</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewAssignments.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 30,
                              height: 30,
                              fontSize: 11,
                              fontWeight: 900,
                              background: getAvatarGradient({
                                id: row.id,
                                firstName: row.employeeName,
                                employeeCode: row.employeeCode,
                              }),
                            }}
                          >
                            {getInitials(row.employeeName)}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {row.employeeName || "—"}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{row.employeeCode || "—"}</TableCell>
                      <TableCell>{formatDate(row.shiftDate)}</TableCell>
                      <TableCell>{timeText(row.shiftStartDt?.slice(11, 16))}</TableCell>
                      <TableCell>{timeText(row.shiftEndDt?.slice(11, 16))}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.status}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            bgcolor: row.status === "Active" ? "#ecfdf5" : "#f1f5f9",
                            color: row.status === "Active" ? "#047857" : "#64748b",
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {viewAssignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: "#94a3b8" }}>
                        No assignments in this batch.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {viewBatch?.status === "Active" && (
            <Button
              color="error"
              onClick={() => cancelBatch(viewBatch)}
              disabled={cancelingId === viewBatch?.batchId}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Cancel batch
            </Button>
          )}
          <Button
            onClick={() => setViewOpen(false)}
            sx={{ textTransform: "none", fontWeight: 700, color: "#64748b" }}
          >
            Close
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

export default BulkShiftAssignment;
