import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Paper, Chip, Box, Typography, InputAdornment,
  Card, CardContent, Divider, Tooltip,
} from "@mui/material";
import {
  Add, Close, EditOutlined, DeleteOutlineOutlined, Search,
  ToggleOn, ToggleOff, Download, AutoAwesome, Warning, CheckCircle,
  Info, PeopleAlt, Business, TrendingUp, TrendingDown,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import http from "../../services/http";

function DepartmentManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filteredDepts, setFilteredDepts] = useState([]);
  const [stats, setStats] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);
  const [empHover, setEmpHover] = useState({});
  const [empLoading, setEmpLoading] = useState({});

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      setUser(stored);
    } catch { setUser(null); }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [deptRes, statsRes, aiRes] = await Promise.all([
        http.get("/api/Department"),
        http.get("/api/Department/stats"),
        http.get("/api/Department/ai-suggestions"),
      ]);
      setDepartments(deptRes.data);
      setFilteredDepts(deptRes.data);
      setStats(statsRes.data);
      setAiSuggestions(aiRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const applyFilters = useCallback(() => {
    let result = [...departments];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    }
    if (filterStatus) {
      result = result.filter(d => d.status === filterStatus);
    }
    setFilteredDepts(result);
    setPage(0);
  }, [departments, search, filterStatus]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const openCreate = () => {
    setEditingDept(null);
    setForm({ name: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (dept) => {
    setEditingDept(dept);
    setForm({ name: dept.name, description: dept.description || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingDept) {
        await http.put(`/api/Department/${editingDept.id}`, { ...editingDept, name: form.name, description: form.description });
      } else {
        await http.post("/api/Department", { name: form.name, description: form.description });
      }
      setDialogOpen(false);
      fetchAll();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;
    try {
      await http.delete(`/api/Department/${id}`);
      fetchAll();
    } catch (e) { console.error(e); }
  };

  const handleToggleStatus = async (dept) => {
    try {
      await http.patch(`/api/Department/${dept.id}/toggle-status`);
      fetchAll();
    } catch (e) { console.error(e); }
  };

  const fetchDeptEmployees = async (deptId) => {
    if (empHover[deptId]) return;
    setEmpLoading(prev => ({ ...prev, [deptId]: true }));
    try {
      const { data } = await http.get(`/api/Department/${deptId}/employees`);
      setEmpHover(prev => ({ ...prev, [deptId]: data }));
    } catch (e) { console.error(e); }
    setEmpLoading(prev => ({ ...prev, [deptId]: false }));
  };

  const exportCSV = () => {
    const headers = ["Name", "Description", "Employees", "Designations", "Status"];
    const rows = filteredDepts.map(d => [d.name, d.description || "", d.employeeCount, d.designationCount, d.status]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().split("T")[0];
    a.download = `departments_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAIColor = (type) => {
    if (type === "warning") return "#f59e0b";
    if (type === "success") return "#10b981";
    return "#3b82f6";
  };

  const getAIDescription = (type, message) => {
    if (message.includes("0 employees")) return "Empty departments increase overhead. Consider merging or removing them.";
    if (message.includes("overstaffed")) return "Too many employees in one dept can cause inefficiency. Redistribute to other teams.";
    if (message.includes("understaffed")) return "Low headcount may cause burnout. Consider hiring more team members.";
    if (message.includes("no designations")) return "Without job titles, career paths are unclear. Define roles for better structure.";
    if (message.includes("well-balanced")) return "Your department structure looks healthy. Keep monitoring!";
    return "";
  };

  const statsCards = stats ? [
    { label: "Total Departments", value: stats.total, icon: <Business sx={{ fontSize: 28, color: "#4f46e5" }} />, bg: "#eef2ff", filterVal: "" },
    { label: "Active", value: stats.active, icon: <TrendingUp sx={{ fontSize: 28, color: "#10b981" }} />, bg: "#ecfdf5", filterVal: "Active" },
    { label: "Inactive", value: stats.inactive, icon: <TrendingDown sx={{ fontSize: 28, color: "#ef4444" }} />, bg: "#fef2f2", filterVal: "Inactive" },
    { label: "Total Employees", value: stats.totalEmployees, icon: <PeopleAlt sx={{ fontSize: 28, color: "#f59e0b" }} />, bg: "#fffbeb", filterVal: "" },
    { label: "Avg Employees/Dept", value: stats.avgEmployeesPerDept, icon: <PeopleAlt sx={{ fontSize: 28, color: "#8b5cf6" }} />, bg: "#f5f3ff", filterVal: "" },
  ] : [];

  const handleStatsClick = (card) => {
    if (card.filterVal) {
      setFilterStatus(prev => prev === card.filterVal ? "" : card.filterVal);
    } else if (card.label === "Total Departments" || card.label === "Total Employees") {
      setFilterStatus("");
    }
  };

  return (
    <div className="dash-page">
      <Sidebar activeKey="departments" onLogout={handleLogout} title="HRMS" user={user} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
        <Navbar userName={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin"} userRole={user?.role || "OWNER"} user={user} onLogout={handleLogout} collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
        <div className="dash-content">
          <div className="dash-header">
            <div>
              <h1 className="dash-title">Departments</h1>
              <p className="dash-subtitle">Manage organizational departments</p>
            </div>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="outlined" startIcon={<Download />} onClick={exportCSV}
                sx={{ textTransform: "none", borderColor: "#d1d5db", color: "#374151" }}>
                Export CSV
              </Button>
              <Button variant="outlined" startIcon={<AutoAwesome />} onClick={() => setShowAI(!showAI)}
                sx={{ textTransform: "none", borderColor: "#8b5cf6", color: "#8b5cf6", "&:hover": { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" } }}>
                {showAI ? "Hide AI" : "AI Insights"}
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={openCreate}
                sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
                Add Department
              </Button>
            </Box>
          </div>

          {/* Stats Cards */}
          {stats && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2, mb: 3 }}>
              {statsCards.map((card) => {
                const isActive = card.filterVal && filterStatus === card.filterVal;
                const isClickable = card.filterVal || card.label === "Total Departments" || card.label === "Total Employees";
                return (
                  <Card key={card.label}
                    onClick={() => isClickable && handleStatsClick(card)}
                    sx={{
                      borderRadius: 3,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      cursor: isClickable ? "pointer" : "default",
                      border: isActive ? "2px solid #4f46e5" : "2px solid transparent",
                      backgroundColor: isActive ? "#f0f4ff" : "white",
                      transition: "all 0.2s ease",
                      "&:hover": isClickable ? { boxShadow: "0 4px 12px rgba(0,0,0,0.12)", transform: "translateY(-2px)" } : {},
                    }}>
                    <CardContent sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: 2, backgroundColor: card.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {card.icon}
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 500 }}>{card.label}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: "#171b2e" }}>{card.value}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* AI Suggestions Panel */}
          {showAI && (
            <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", mb: 3, border: "1px solid #e5e7eb" }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <AutoAwesome sx={{ color: "#8b5cf6" }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e" }}>AI Department Insights</Typography>
                </Box>
                {!aiSuggestions ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" sx={{ color: "#6b7280" }}>Analyzing departments...</Typography>
                  </Box>
                ) : (
                  <>
                    <Typography variant="body2" sx={{ color: "#6b7280", mb: 2 }}>{aiSuggestions.summary}</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {aiSuggestions.suggestions.map((s, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: 1.5, borderRadius: 2, backgroundColor: `${getAIColor(s.type)}08`, border: `1px solid ${getAIColor(s.type)}20` }}>
                          {s.type === "warning" && <Warning sx={{ color: getAIColor(s.type), fontSize: 20, mt: 0.3 }} />}
                          {s.type === "success" && <CheckCircle sx={{ color: getAIColor(s.type), fontSize: 20, mt: 0.3 }} />}
                          {s.type === "info" && <Info sx={{ color: getAIColor(s.type), fontSize: 20, mt: 0.3 }} />}
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{s.message}</Typography>
                            <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", mt: 0.5 }}>
                              {getAIDescription(s.type, s.message)}
                            </Typography>
                            <Chip label={s.priority} size="small" sx={{ mt: 0.5, height: 20, fontSize: 11 }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <TextField placeholder="Search departments..." size="small" value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
            <Box sx={{ display: "flex", gap: 1 }}>
              {["", "Active", "Inactive"].map((status) => (
                <Chip key={status} label={status || "All"} onClick={() => setFilterStatus(status)}
                  variant={filterStatus === status ? "filled" : "outlined"}
                  color={filterStatus === status ? "primary" : "default"}
                  sx={{ cursor: "pointer" }} />
              ))}
            </Box>
            {filterStatus && (
              <Chip label={`Filter: ${filterStatus}`} onDelete={() => setFilterStatus("")}
                color="primary" variant="outlined" size="small" />
            )}
          </Box>

          {/* Table */}
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f9fafb" }}>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Employees</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Designations</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDepts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((dept, idx) => (
                    <TableRow key={dept.id} hover sx={{ "&:hover": { backgroundColor: "#f9fafb" } }}>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{dept.name}</TableCell>
                      <TableCell sx={{ color: "#6b7280" }}>{dept.description || "—"}</TableCell>
                      <TableCell>
                        <Tooltip
                          title={
                            empLoading[dept.id] ? (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
                                <CircularProgress size={14} />
                                <Typography variant="caption">Loading employees...</Typography>
                              </Box>
                            ) : empHover[dept.id] && empHover[dept.id].length > 0 ? (
                              <Box sx={{ p: 0.5, maxWidth: 280 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                                  {dept.name} — {empHover[dept.id].length} employee(s)
                                </Typography>
                                {empHover[dept.id].map((emp, i) => (
                                  <Typography key={i} variant="caption" display="block" sx={{ lineHeight: 1.4 }}>
                                    {emp.firstName} {emp.lastName} — {emp.designationTitle || "No designation"}
                                  </Typography>
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ p: 0.5, display: "block" }}>
                                No employees in this department
                              </Typography>
                            )
                          }
                          arrow
                          placement="right"
                          onOpen={() => dept.employeeCount > 0 && fetchDeptEmployees(dept.id)}
                        >
                          <Chip
                            label={`${dept.employeeCount} employee${dept.employeeCount !== 1 ? 's' : ''}`}
                            size="small"
                            sx={{
                              backgroundColor: dept.employeeCount > 0 ? "#eef2ff" : "#f3f4f6",
                              color: dept.employeeCount > 0 ? "#4f46e5" : "#9ca3af",
                              fontWeight: 600,
                              cursor: dept.employeeCount > 0 ? "pointer" : "default",
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip label={dept.designationCount} size="small" variant="outlined"
                          sx={{ fontWeight: 500 }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={dept.status} size="small"
                          color={dept.status === "Active" ? "success" : "default"} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={dept.status === "Active" ? "Deactivate" : "Activate"}>
                          <IconButton size="small" onClick={() => handleToggleStatus(dept)}
                            color={dept.status === "Active" ? "success" : "default"}>
                            {dept.status === "Active" ? <ToggleOn /> : <ToggleOff />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(dept)}>
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(dept.id)}>
                            <DeleteOutlineOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDepts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8, color: "#9ca3af" }}>
                        {search || filterStatus ? "No departments match your filters" : "No departments found. Create your first department!"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredDepts.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </TableContainer>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingDept ? "Edit Department" : "Add Department"}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: "absolute", right: 8, top: 8 }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField label="Department Name" fullWidth margin="normal" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          <TextField label="Description" fullWidth margin="normal" multiline rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()}
            sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
            {saving ? <CircularProgress size={20} /> : editingDept ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default DepartmentManagement;
