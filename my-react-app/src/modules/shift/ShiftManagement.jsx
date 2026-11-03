import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  InputAdornment,
  Paper,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  Add,
  BoltOutlined,
  Close,
  EditOutlined,
  NightsStay,
  Refresh,
  Search,
  Timelapse,
  WbSunny,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import shiftService from "../../services/shiftService";
import {
  ShiftHero,
  ShiftStatCard,
  ShiftTimeline,
  computeShiftWindow,
  getShiftPalette,
  gradientButtonSx,
  heroButtonSx,
  heroSolidButtonSx,
  timeText,
} from "./shiftUi";

const blankForm = { shiftName: "", startTime: "06:00", durationHours: 10, isActive: true };

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

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

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await shiftService.getAll();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load shifts error:", err);
      setError("Could not load shifts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setFormError("");
    setDialogOpen(true);
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
    setDialogOpen(true);
  };

  const handleSave = async (event) => {
    event?.preventDefault();
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
      setDialogOpen(false);
      await loadShifts();
    } catch (err) {
      console.error("Save shift error:", err);
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
      console.error("Toggle shift error:", err);
      showToast(err.response?.data?.message || "Could not update this shift.", "error");
    }
  };

  const activeCount = shifts.filter((shift) => shift.isActive).length;
  const inactiveCount = shifts.length - activeCount;
  const midnightCount = shifts.filter((shift) => shift.crossesMidnight).length;
  const avgDuration = shifts.length
    ? shifts.reduce((sum, shift) => sum + num(shift.durationHours), 0) / shifts.length
    : 0;

  const filteredShifts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shifts.filter((shift) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "active" ? shift.isActive : !shift.isActive);
      const textMatch =
        !query ||
        String(shift.shiftName || "").toLowerCase().includes(query) ||
        timeText(shift.startTime).includes(query) ||
        timeText(shift.endTime).includes(query);
      return statusMatch && textMatch;
    });
  }, [shifts, search, statusFilter]);

  const statusOptions = [
    { key: "all", label: `All ${shifts.length}`, color: "#6366f1", bg: "#eef2ff" },
    { key: "active", label: `Active ${activeCount}`, color: "#10b981", bg: "#ecfdf5" },
    { key: "inactive", label: `Inactive ${inactiveCount}`, color: "#64748b", bg: "#f1f5f9" },
  ];

  const preview = computeShiftWindow(form.startTime, form.durationHours);
  const formPalette = getShiftPalette({
    startTime: form.startTime,
    crossesMidnight: preview.crossesMidnight,
  });

  return (
    <div className="dash-page">
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
          <ShiftHero
            eyebrow="Workforce scheduling"
            title="Shift Studio"
            subtitle="Design colorful shift windows, keep them assignable, and spot overnight coverage at a glance."
            icon={AccessTime}
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 55%, #8b5cf6 100%)"
            stats={[
              { label: "Total", value: shifts.length },
              { label: "Active", value: activeCount },
              { label: "Overnight", value: midnightCount },
            ]}
            actions={
              <>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadShifts}
                  disabled={loading}
                  sx={heroButtonSx}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={openCreate}
                  sx={heroSolidButtonSx}
                >
                  Create shift
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
              label="Total shifts"
              value={shifts.length}
              hint="Catalog size"
              icon={AccessTime}
              color="#6366f1"
              bg="#eef2ff"
            />
            <ShiftStatCard
              label="Active"
              value={activeCount}
              hint="Ready to assign"
              icon={BoltOutlined}
              color="#10b981"
              bg="#ecfdf5"
            />
            <ShiftStatCard
              label="Overnight"
              value={midnightCount}
              hint="Crosses midnight"
              icon={NightsStay}
              color="#8b5cf6"
              bg="#f5f3ff"
            />
            <ShiftStatCard
              label="Avg duration"
              value={`${avgDuration.toFixed(1)}h`}
              hint="Per shift"
              icon={Timelapse}
              color="#f59e0b"
              bg="#fffbeb"
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box
            sx={{
              display: "flex",
              gap: 1.25,
              mb: 2.25,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TextField
              size="small"
              placeholder="Search by name or time..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{
                flex: { xs: "1 1 100%", sm: "0 1 310px" },
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  bgcolor: "#fff",
                  boxShadow: "0 12px 28px -26px rgba(30,41,59,0.65)",
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: "#94a3b8", fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {statusOptions.map((option) => {
                const selected = statusFilter === option.key;
                return (
                  <Chip
                    key={option.key}
                    label={option.label}
                    clickable
                    onClick={() => setStatusFilter(option.key)}
                    sx={{
                      fontWeight: 800,
                      borderRadius: 2,
                      bgcolor: selected ? option.color : option.bg,
                      color: selected ? "#fff" : option.color,
                      border: `1px solid ${option.color}22`,
                      "&:hover": { bgcolor: selected ? option.color : `${option.color}18` },
                    }}
                  />
                );
              })}
            </Box>
          </Box>

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
                Loading your shift catalog...
              </Typography>
            </Paper>
          ) : filteredShifts.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                textAlign: "center",
                borderRadius: 4,
                border: "1px dashed #c7d2fe",
                background: "linear-gradient(150deg, #ffffff, #eef2ff)",
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 3,
                  mx: "auto",
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  background: shifts.length ? "#94a3b8" : "linear-gradient(135deg, #667eea, #764ba2)",
                  boxShadow: "0 18px 32px -18px rgba(102,126,234,0.7)",
                }}
              >
                <AccessTime sx={{ fontSize: 32 }} />
              </Box>
              <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
                {shifts.length === 0 ? "No shifts yet" : "No shifts match"}
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
                {shifts.length === 0
                  ? "Create your first shift window before assigning employees."
                  : "Try a different search or switch the status filter."}
              </Typography>
              {shifts.length === 0 ? (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={openCreate}
                  sx={gradientButtonSx()}
                >
                  Add first shift
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  sx={{ textTransform: "none", fontWeight: 800, color: "#6366f1" }}
                >
                  Clear filters
                </Button>
              )}
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 2,
              }}
            >
              {filteredShifts.map((shift) => {
                const palette = getShiftPalette(shift);
                return (
                  <Paper
                    key={shift.shiftId}
                    elevation={0}
                    sx={{
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: 3.5,
                      bgcolor: "#fff",
                      border: "1px solid",
                      borderColor: shift.isActive ? `${palette.main}33` : "#e5e7eb",
                      boxShadow: shift.isActive
                        ? `0 18px 36px -34px ${palette.main}`
                        : "0 10px 24px -24px rgba(15,23,42,0.4)",
                      opacity: shift.isActive ? 1 : 0.74,
                      transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, opacity 0.22s ease",
                      "&:hover": {
                        transform: "translateY(-5px)",
                        opacity: 1,
                        borderColor: palette.main,
                        boxShadow: `0 26px 46px -30px ${palette.glow}`,
                      },
                    }}
                  >
                    <Box sx={{ height: 6, background: palette.gradient }} />
                    <Box sx={{ p: 2.25 }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                        <Box
                          sx={{
                            width: 46,
                            height: 46,
                            borderRadius: 2.5,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            background: palette.gradient,
                            boxShadow: `0 12px 22px -14px ${palette.glow}`,
                          }}
                        >
                          {palette.name === "Night" ? (
                            <NightsStay sx={{ fontSize: 24 }} />
                          ) : (
                            <WbSunny sx={{ fontSize: 24 }} />
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                            <Typography sx={{ fontWeight: 900, fontSize: 17, wordBreak: "break-word" }}>
                              {shift.shiftName}
                            </Typography>
                            <Chip
                              label={palette.name}
                              size="small"
                              sx={{
                                height: 22,
                                fontWeight: 800,
                                bgcolor: palette.soft,
                                color: palette.dark,
                                border: `1px solid ${palette.main}33`,
                              }}
                            />
                          </Box>
                          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", mt: 0.5 }}>
                            <Typography variant="body2" sx={{ color: "#475569" }}>
                              <Box component="span" sx={{ fontWeight: 900, color: palette.dark }}>
                                {timeText(shift.startTime)}
                              </Box>
                              {" → "}
                              <Box component="span" sx={{ fontWeight: 900, color: palette.dark }}>
                                {timeText(shift.endTime)}
                              </Box>
                            </Typography>
                            {shift.crossesMidnight && (
                              <Chip
                                icon={<NightsStay sx={{ fontSize: "14px !important" }} />}
                                label="next day"
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  bgcolor: palette.soft,
                                  color: palette.dark,
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                          <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 800 }}>
                            {num(shift.durationHours)}h window
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                            24h view
                          </Typography>
                        </Box>
                        <ShiftTimeline shift={shift} palette={palette} />
                      </Box>

                      <Box sx={{ display: "flex", gap: 0.75, mt: 1.75, flexWrap: "wrap" }}>
                        <Chip
                          label={shift.isActive ? "Active" : "Inactive"}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: shift.isActive ? "#ecfdf5" : "#f1f5f9",
                            color: shift.isActive ? "#047857" : "#64748b",
                          }}
                        />
                        <Chip
                          label={`${num(shift.durationHours)} hours`}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: "#e2e8f0", color: "#64748b" }}
                        />
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          mt: 1.75,
                          pt: 1.5,
                          borderTop: "1px dashed #e2e8f0",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Switch
                            size="small"
                            checked={Boolean(shift.isActive)}
                            onChange={(event) => toggleActive(shift, event.target.checked)}
                            inputProps={{ "aria-label": `Toggle ${shift.shiftName}` }}
                            sx={{
                              "& .MuiSwitch-switchBase.Mui-checked": { color: palette.main },
                              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                bgcolor: palette.main,
                              },
                            }}
                          />
                          <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                            {shift.isActive ? "Assignable" : "Paused"}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<EditOutlined />}
                          onClick={() => openEdit(shift)}
                          sx={{
                            textTransform: "none",
                            fontWeight: 800,
                            color: palette.dark,
                            borderRadius: 2,
                            "&:hover": { bgcolor: palette.soft },
                          }}
                        >
                          Edit
                        </Button>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="sm"
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
              background: formPalette.hero,
              "&::after": {
                content: '""',
                position: "absolute",
                width: 160,
                height: 160,
                borderRadius: "50%",
                top: -80,
                right: -40,
                background: "rgba(255,255,255,0.15)",
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
                <AccessTime />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" sx={{ opacity: 0.78, fontWeight: 700, letterSpacing: 1.4 }}>
                  {editing ? "Edit shift" : "New shift"}
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 20, lineHeight: 1.15 }} noWrap>
                  {form.shiftName.trim() || "Untitled shift"}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              sx={{ position: "absolute", right: 8, top: 8, color: "#fff", zIndex: 2 }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Box
            component="form"
            onSubmit={handleSave}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              "& .MuiOutlinedInput-root": { borderRadius: 2.5 },
            }}
          >
            {formError && <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>}

            <TextField
              label="Shift name"
              value={form.shiftName}
              onChange={(event) => setForm((current) => ({ ...current, shiftName: event.target.value }))}
              placeholder="e.g. Shift A"
              required
              fullWidth
              autoFocus
            />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Start time"
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Duration (hours)"
                type="number"
                value={form.durationHours}
                onChange={(event) =>
                  setForm((current) => ({ ...current, durationHours: event.target.value }))
                }
                inputProps={{ min: 0.5, max: 23.5, step: 0.5 }}
                required
                fullWidth
              />
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: `1px solid ${formPalette.main}33`,
                background: `linear-gradient(135deg, #ffffff, ${formPalette.soft})`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.75 }}>
                <Typography variant="caption" sx={{ color: formPalette.dark, fontWeight: 900, letterSpacing: 0.5 }}>
                  LIVE PREVIEW
                </Typography>
                <Chip
                  label={formPalette.name}
                  size="small"
                  sx={{ height: 22, bgcolor: formPalette.soft, color: formPalette.dark, fontWeight: 800 }}
                />
              </Box>
              <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
                {preview.start}{" "}
                <Box component="span" sx={{ color: formPalette.main }}>
                  →
                </Box>{" "}
                {preview.end}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                {preview.duration}h {preview.crossesMidnight ? "· ends next day" : "· same day"}
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <ShiftTimeline
                  shift={{ startTime: form.startTime, durationHours: form.durationHours }}
                  palette={formPalette}
                  showLabels
                />
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                p: 1.5,
                borderRadius: 2.5,
                bgcolor: form.isActive ? formPalette.soft : "#f8fafc",
                border: "1px solid",
                borderColor: form.isActive ? `${formPalette.main}33` : "#eef0f6",
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Available for assignment
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b" }}>
                  Inactive shifts stay in the catalog but cannot be chosen.
                </Typography>
              </Box>
              <Switch
                checked={Boolean(form.isActive)}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                inputProps={{ "aria-label": "Shift active" }}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: formPalette.main },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    bgcolor: formPalette.main,
                  },
                }}
              />
            </Box>

            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
              End time is calculated automatically. A shift crossing midnight is marked automatically.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={saving}
            sx={{ textTransform: "none", fontWeight: 700, color: "#64748b" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={gradientButtonSx(formPalette)}
          >
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : editing ? (
              "Update shift"
            ) : (
              "Create shift"
            )}
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

export default ShiftManagement;
