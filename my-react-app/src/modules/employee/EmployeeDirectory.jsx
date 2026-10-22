import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Paper, Chip, Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem,
  InputAdornment, Alert, Snackbar, Tooltip, Divider, Card, CardContent,
} from "@mui/material";
import { Add, Close, EditOutlined, Search, PersonOff, Person, Visibility, UploadFile, CheckCircle, RadioButtonUnchecked, PhoneOutlined, HomeOutlined, EmergencyOutlined, FamilyRestroom, SchoolOutlined, BusinessOutlined, EmailOutlined, BadgeOutlined, LocationOnOutlined, WorkOutlineOutlined, CalendarMonth, CategoryOutlined } from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import employeeServ from "../../services/employeeService";
import educationServ from "../../services/educationService";
import documentServ from "../../services/documentService";
import http from "../../services/http";

function EmployeeDirectory() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProfile, setFilterProfile] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docEmployeeId, setDocEmployeeId] = useState(null);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", address: "",
    departmentId: "", designationId: "", employmentType: "FULL_TIME", joiningDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [errors, setErrors] = useState({});
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [viewEducation, setViewEducation] = useState([]);
  const [viewDocuments, setViewDocuments] = useState([]);
  const [viewSystemADocs, setViewSystemADocs] = useState([]);
  const [docPreviewUrl, setDocPreviewUrl] = useState(null);
  const [docPreviewName, setDocPreviewName] = useState("");
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [docDeleting, setDocDeleting] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      setUser(stored);
    } catch { setUser(null); }
    fetchAll();
  }, []);

  const handleViewDoc = async (docType, employeeId) => {
    try {
      const res = await http.get(`/api/Document/view-by-employee?employeeId=${employeeId}&documentType=${docType}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      setDocPreviewUrl(url);
      setDocPreviewName(docType);
      setDocPreviewOpen(true);
    } catch (e) {
      console.error("Failed to load document", e);
    }
  };

  const handleDownloadDoc = async (docType, employeeId, fileName) => {
    try {
      const res = await http.get(`/api/Document/view-by-employee?employeeId=${employeeId}&documentType=${docType}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `${docType}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download document", e);
    }
  };

  const handleDeleteDoc = async (docType, employeeId) => {
    if (!window.confirm(`Delete ${docType.replace(/_/g, " ")} document?`)) return;
    setDocDeleting(docType);
    try {
      await documentServ.removeByType(employeeId, docType);
      setViewDocuments(prev => prev.filter(d => d.documentType !== docType));
      setViewSystemADocs(prev => prev.filter(d => d.type !== docType));
    } catch (e) {
      console.error("Failed to delete document", e);
    } finally {
      setDocDeleting(null);
    }
  };

  const fetchAll = async () => {
    try {
      const [empRes, deptRes, desRes] = await Promise.allSettled([
        employeeServ.getAll(),
        http.get("/api/Department"),
        http.get("/api/Designation"),
      ]);
      if (empRes.status === "fulfilled") {
        const { data } = empRes.value;
        setEmployees(data);
      }
      if (deptRes.status === "fulfilled") {
        const { data } = deptRes.value;
        setDepartments(data);
      }
      if (desRes.status === "fulfilled") {
        const { data } = desRes.value;
        setDesignations(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchEmployees = useCallback(async () => {
    const params = {};
    if (filterDept) params.departmentId = filterDept;
    if (filterStatus) params.status = filterStatus;
    if (filterProfile) params.profileComplete = filterProfile;
    if (search) params.search = search;
    try {
      const { data } = await employeeServ.getAll(params);
      setEmployees(data);
    } catch (e) { console.error(e); }
  }, [filterDept, filterStatus, filterProfile, search]);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!filterDept && !filterStatus && !filterProfile && !search) return;
    const timer = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ firstName: "", lastName: "", email: "", phone: "", address: "", departmentId: "", designationId: "", employmentType: "FULL_TIME", joiningDate: "" });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      firstName: emp.firstName || "", lastName: emp.lastName || "", email: emp.email || "",
      phone: emp.phone || "", address: emp.address || "", departmentId: emp.departmentId || "",
      designationId: emp.designationId || "", employmentType: emp.employmentType || "FULL_TIME",
      joiningDate: emp.joiningDate ? emp.joiningDate.split("T")[0] : "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const newErrors = {};
    if (!form.firstName.trim()) {
      newErrors.firstName = "First name is required";
    } else if (form.firstName.trim().length < 2) {
      newErrors.firstName = "First name must be at least 2 characters";
    }
    if (!form.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!form.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(form.phone)) {
      newErrors.phone = "Enter a valid phone number (7-15 digits)";
    }
    if (!form.departmentId) {
      newErrors.departmentId = "Department is required";
    }
    if (!form.designationId) {
      newErrors.designationId = "Designation is required";
    }
    if (!form.employmentType) {
      newErrors.employmentType = "Employment type is required";
    }
    if (!form.joiningDate) {
      newErrors.joiningDate = "Joining date is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        phone: form.phone, address: form.address, employmentType: form.employmentType,
        departmentId: form.departmentId ? parseInt(form.departmentId) : null,
        designationId: form.designationId ? parseInt(form.designationId) : null,
        joiningDate: form.joiningDate || null,
      };
      if (editing) {
        await employeeServ.update(editing.id, body);
      } else {
        const { data: result } = await employeeServ.create(body);
        if (result.tempPassword) {
          setSuccessInfo({ name: `${form.firstName} ${form.lastName}`, email: form.email, password: result.tempPassword, employeeCode: result.employeeCode });
        }
      }
      setDialogOpen(false);
      await fetchAll();
      setPage(0);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleStatus = async (emp) => {
    const action = emp.status === "Active" ? "deactivate" : "activate";
    try {
      await employeeServ.toggleAction(emp.id, action);
      fetchAll();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="dash-page emp-page">
      <Sidebar activeKey="directory" onLogout={handleLogout} title="HRMS" user={user} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
        <Navbar userName={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin"} userRole={user?.role || "OWNER"} user={user} onLogout={handleLogout} collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
        <div className="dash-content">
          <div className="dash-header">
            <div>
              <h1 className="dash-title">Employee Directory</h1>
              <p className="dash-subtitle">{employees.length} total employees</p>
            </div>
            <Button variant="contained" startIcon={<Add />} onClick={openCreate}
              sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
              Add Employee
            </Button>
          </div>

          {/* Filters */}
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <TextField placeholder="Search by name, email, code..." size="small" value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Department</InputLabel>
              <Select value={filterDept} label="Department" onChange={(e) => setFilterDept(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={(e) => setFilterStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Profile</InputLabel>
              <Select value={filterProfile} label="Profile" onChange={(e) => setFilterProfile(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Complete</MenuItem>
                <MenuItem value="false">Pending</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f9fafb" }}>
                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Designation</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Profile</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((emp) => (
                    <TableRow key={emp.id} hover>
                      <TableCell><Chip label={emp.employeeCode || "—"} size="small" variant="outlined" /></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.departmentName || "—"}</TableCell>
                      <TableCell>{emp.designationTitle || "—"}</TableCell>
                      <TableCell>
                        <Chip label={emp.status} size="small"
                          color={emp.status === "Active" ? "success" : "default"} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={emp.profileComplete ? <CheckCircle sx={{ fontSize: 16 }} /> : <RadioButtonUnchecked sx={{ fontSize: 16 }} />}
                          label={emp.profileComplete ? "Complete" : "Pending"}
                          size="small"
                          color={emp.profileComplete ? "success" : "warning"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={async () => {
                            setViewEmployee(emp);
                            setViewDialogOpen(true);
                            try {
                              const [eduRes, docRes, sysARes] = await Promise.all([
                                educationServ.getByEmployee(emp.id),
                                documentServ.getByEmployee(emp.id),
                                documentServ.getDocsByEmployee(emp.id),
                              ]);
                              setViewEducation(eduRes.data);
                              setViewDocuments(docRes.data);
                              setViewSystemADocs(sysARes.data);
                            } catch (e) { console.error(e); }
                          }}>
                            <Visibility fontSize="small" sx={{ color: "#4f46e5" }} />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => openEdit(emp)} title="Edit"><EditOutlined fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => toggleStatus(emp)} title={emp.status === "Active" ? "Deactivate" : "Activate"}
                          color={emp.status === "Active" ? "warning" : "success"}>
                          {emp.status === "Active" ? <PersonOff fontSize="small" /> : <Person fontSize="small" />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {employees.length === 0 && (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: "#9ca3af" }}>No employees found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={employees.length}
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        {/* Header */}
        <Box sx={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {editing ? <EditOutlined sx={{ color: "white" }} /> : <Person sx={{ color: "white" }} />}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "white", lineHeight: 1.2 }}>{editing ? "Edit Employee" : "Add New Employee"}</Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>{editing ? "Update employee details below" : "Fill in the details to onboard a new employee"}</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setDialogOpen(false)} sx={{ color: "rgba(255,255,255,0.8)", "&:hover": { bgcolor: "rgba(255,255,255,0.15)" } }}><Close /></IconButton>
        </Box>

        <DialogContent sx={{ p: 0, mt: 0, bgcolor: "#f8fafc" }}>
          {!editing && (
            <Alert severity="info" sx={{ mx: 3, mt: 2, borderRadius: 2, border: "1px solid #bfdbfe" }}>
              A user account will be auto-created. Default password: <strong>Employee@123</strong>
            </Alert>
          )}

          {/* Personal Information Card */}
          <Card sx={{ mx: 3, mt: 2, borderRadius: 2, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s, border-color 0.2s", "&:hover": { boxShadow: "0 4px 12px rgba(79,70,229,0.1)", borderColor: "#c7d2fe" } }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Person sx={{ fontSize: 18, color: "#4f46e5" }} />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#171b2e" }}>Personal Information</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="First Name" placeholder="e.g. Rahul" value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    error={!!errors.firstName} helperText={errors.firstName} required fullWidth size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 18, color: "#9ca3af" }} /></InputAdornment> }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, "&:hover fieldset": { borderColor: "#a5b4fc" }, "&.Mui-focused fieldset": { borderColor: "#4f46e5" } } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Last Name" placeholder="e.g. Sharma" value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    error={!!errors.lastName} helperText={errors.lastName} required fullWidth size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 18, color: "#9ca3af" }} /></InputAdornment> }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, "&:hover fieldset": { borderColor: "#a5b4fc" }, "&.Mui-focused fieldset": { borderColor: "#4f46e5" } } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Email" placeholder="e.g. rahul@example.com" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    error={!!errors.email} helperText={errors.email} required fullWidth size="small" disabled={!!editing}
                    InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ fontSize: 18, color: "#9ca3af" }} /></InputAdornment> }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, "&:hover fieldset": { borderColor: "#a5b4fc" }, "&.Mui-focused fieldset": { borderColor: "#4f46e5" } } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Phone" placeholder="e.g. +91 9876543210" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    error={!!errors.phone} helperText={errors.phone} fullWidth size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start"><PhoneOutlined sx={{ fontSize: 18, color: "#9ca3af" }} /></InputAdornment> }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, "&:hover fieldset": { borderColor: "#a5b4fc" }, "&.Mui-focused fieldset": { borderColor: "#4f46e5" } } }} />
                </Grid>
                <Grid size={12}>
                  <TextField label="Address" placeholder="e.g. 123 MG Road, Mumbai" value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    fullWidth size="small" multiline rows={2}
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 0.5 }}><LocationOnOutlined sx={{ fontSize: 18, color: "#9ca3af" }} /></InputAdornment> }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, "&:hover fieldset": { borderColor: "#a5b4fc" }, "&.Mui-focused fieldset": { borderColor: "#4f46e5" } } }} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Work Details Card */}
          <Card sx={{ mx: 3, mt: 2, mb: 2, borderRadius: 2, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s, border-color 0.2s", "&:hover": { boxShadow: "0 4px 12px rgba(79,70,229,0.1)", borderColor: "#c7d2fe" } }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BusinessOutlined sx={{ fontSize: 18, color: "#4f46e5" }} />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#171b2e" }}>Work Details</Typography>
              </Box>
              {/* Row 1: 3 boxes */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth size="small" error={!!errors.departmentId}>
                    <InputLabel sx={{ "&.Mui-focused": { color: "#4f46e5" } }}>Department *</InputLabel>
                    <Select value={form.departmentId} label="Department *" displayEmpty onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                      startAdornment={<InputAdornment position="start"><CategoryOutlined sx={{ fontSize: 18, color: "#9ca3af", ml: -0.5 }} /></InputAdornment>}
                      sx={{ borderRadius: 2, minHeight: 40, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#a5b4fc" }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#4f46e5" } }}>
                      <MenuItem value="" disabled sx={{ color: "#9ca3af" }}>Select Department</MenuItem>
                      {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                    </Select>
                    {errors.departmentId && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.departmentId}</Typography>}
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth size="small" error={!!errors.designationId}>
                    <InputLabel sx={{ "&.Mui-focused": { color: "#4f46e5" } }}>Designation *</InputLabel>
                    <Select value={form.designationId} label="Designation *" displayEmpty onChange={(e) => setForm({ ...form, designationId: e.target.value })}
                      startAdornment={<InputAdornment position="start"><BadgeOutlined sx={{ fontSize: 18, color: "#9ca3af", ml: -0.5 }} /></InputAdornment>}
                      sx={{ borderRadius: 2, minHeight: 40, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#a5b4fc" }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#4f46e5" } }}>
                      <MenuItem value="" disabled sx={{ color: "#9ca3af" }}>Select Designation</MenuItem>
                      {designations.map((d) => <MenuItem key={d.id} value={d.id}>{d.title}</MenuItem>)}
                    </Select>
                    {errors.designationId && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.designationId}</Typography>}
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth size="small" error={!!errors.employmentType}>
                    <InputLabel sx={{ "&.Mui-focused": { color: "#4f46e5" } }}>Employment Type *</InputLabel>
                    <Select value={form.employmentType} label="Employment Type *" displayEmpty onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                      startAdornment={<InputAdornment position="start"><WorkOutlineOutlined sx={{ fontSize: 18, color: "#9ca3af", ml: -0.5 }} /></InputAdornment>}
                      sx={{ borderRadius: 2, minHeight: 40, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#a5b4fc" }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#4f46e5" } }}>
                      <MenuItem value="" disabled sx={{ color: "#9ca3af" }}>Select Type</MenuItem>
                      <MenuItem value="FULL_TIME">Full Time</MenuItem>
                      <MenuItem value="CONTRACT">Contract</MenuItem>
                      <MenuItem value="INTERN">Intern</MenuItem>
                    </Select>
                    {errors.employmentType && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.employmentType}</Typography>}
                  </FormControl>
                </Grid>
              </Grid>
              {/* Row 2: Joining Date - left side */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: errors.joiningDate ? "#d32f2f" : "#374151", mb: 0.5, display: "block", fontSize: 12 }}>Joining Date *</Typography>
                    <TextField type="date" value={form.joiningDate} fullWidth size="small"
                      onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                      error={!!errors.joiningDate}
                      inputProps={{ min: "2000-01-01", max: "2030-12-31" }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><CalendarMonth sx={{ fontSize: 18, color: "#9ca3af" }} /></InputAdornment> }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, minHeight: 40, "&:hover fieldset": { borderColor: "#a5b4fc" }, "&.Mui-focused fieldset": { borderColor: "#4f46e5" } } }} />
                    {errors.joiningDate ? (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.joiningDate}</Typography>
                    ) : (
                      <Typography variant="caption" sx={{ color: "#9ca3af", mt: 0.5, ml: 1.5 }}>Format: DD/MM/YYYY</Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </DialogContent>

        {/* Footer */}
        <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #e5e7eb", bgcolor: "#f8fafc" }}>
          <Button onClick={() => setDialogOpen(false)}
            sx={{ textTransform: "none", color: "#6b7280", fontWeight: 600, borderRadius: 2, px: 3, border: "1px solid #d1d5db", "&:hover": { bgcolor: "#f3f4f6", borderColor: "#9ca3af" } }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : (editing ? <EditOutlined /> : <CheckCircle />)}
            sx={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", "&:hover": { background: "linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)" }, textTransform: "none", px: 4, fontWeight: 600, borderRadius: 2, boxShadow: "0 2px 8px rgba(79,70,229,0.3)" }}>
            {saving ? "Saving..." : editing ? "Update Employee" : "Create Employee"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Dialog — shows temp password after creating employee */}
      <Dialog open={Boolean(successInfo)} onClose={() => { setSuccessInfo(null); fetchAll(); setPage(0); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <CheckCircle sx={{ color: "#10b981" }} /> Employee Created Successfully
        </DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>{successInfo?.name}</strong> ({successInfo?.email}) has been created.<br />
            Employee Code: <strong>{successInfo?.employeeCode}</strong>
          </Alert>
          <Paper sx={{ p: 2, backgroundColor: "#fef3c7", border: "1px solid #f59e0b" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#92400e" }}>Share these login credentials with the employee:</p>
            <p style={{ margin: "8px 0 4px", fontSize: 14, color: "#78350f" }}>Email: <strong>{successInfo?.email}</strong></p>
            <p style={{ margin: 0, fontSize: 14, color: "#78350f" }}>Password: <strong style={{ fontSize: 16 }}>{successInfo?.password}</strong></p>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => { setSuccessInfo(null); fetchAll(); setPage(0); }}
            sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Employee Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Person sx={{ color: "#4f46e5" }} /> Employee Details
          </Box>
          <IconButton onClick={() => setViewDialogOpen(false)} size="small"><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewEmployee && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Header */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, pb: 2, borderBottom: "1px solid #e5e7eb" }}>
                <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "#4f46e5" }}>
                    {(viewEmployee.firstName || "E")[0]}{(viewEmployee.lastName || "")[0] || ""}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{viewEmployee.firstName} {viewEmployee.lastName}</Typography>
                  <Typography variant="body2" sx={{ color: "#6b7280" }}>{viewEmployee.email}</Typography>
                </Box>
                <Box sx={{ ml: "auto" }}>
                  <Chip icon={viewEmployee.profileComplete ? <CheckCircle sx={{ fontSize: 16 }} /> : <RadioButtonUnchecked sx={{ fontSize: 16 }} />}
                    label={viewEmployee.profileComplete ? "Complete" : "Pending"} size="small"
                    color={viewEmployee.profileComplete ? "success" : "warning"} variant="outlined" />
                </Box>
              </Box>

              {/* Basic Info */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#4f46e5", mb: 1.5 }}>Basic Information</Typography>
                <Grid container spacing={1.5}>
                  {[
                    { label: "Employee Code", value: viewEmployee.employeeCode || "—" },
                    { label: "Department", value: viewEmployee.departmentName || "—" },
                    { label: "Designation", value: viewEmployee.designationTitle || "—" },
                    { label: "Employment Type", value: viewEmployee.employmentType || "—" },
                    { label: "Status", value: viewEmployee.status },
                  ].map((item) => (
                    <Grid size={6} key={item.label}>
                      <Typography variant="caption" sx={{ color: "#9ca3af" }}>{item.label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Divider />

              {/* Personal Info */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#4f46e5", mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <FamilyRestroom sx={{ fontSize: 18 }} /> Personal Information
                </Typography>
                <Grid container spacing={1.5}>
                  {[
                    { label: "Father's Name", value: viewEmployee.fatherName || "Not provided" },
                    { label: "Mother's Name", value: viewEmployee.motherName || "Not provided" },
                    { label: "Gender", value: viewEmployee.gender || "Not provided" },
                    { label: "DOB", value: viewEmployee.dob ? new Date(viewEmployee.dob).toLocaleDateString("en-IN") : "Not provided" },
                  ].map((item) => (
                    <Grid size={6} key={item.label}>
                      <Typography variant="caption" sx={{ color: "#9ca3af" }}>{item.label}</Typography>
                      <Typography variant="body2" sx={{
                        fontWeight: 600,
                        color: item.value === "Not provided" ? "#d1d5db" : "#171b2e",
                        fontStyle: item.value === "Not provided" ? "italic" : "normal",
                      }}>{item.value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Divider />

              {/* Contact */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#4f46e5", mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <PhoneOutlined sx={{ fontSize: 18 }} /> Contact Information
                </Typography>
                <Grid container spacing={1.5}>
                  {[
                    { label: "Phone", value: viewEmployee.phone || "Not provided" },
                    { label: "Address", value: viewEmployee.address || "Not provided" },
                    { label: "Emergency Contact", value: viewEmployee.emergencyContact || "Not provided" },
                  ].map((item) => (
                    <Grid size={{ xs: 12, sm: 4 }} key={item.label}>
                      <Typography variant="caption" sx={{ color: "#9ca3af" }}>{item.label}</Typography>
                      <Typography variant="body2" sx={{
                        fontWeight: 600,
                        color: item.value === "Not provided" ? "#d1d5db" : "#171b2e",
                        fontStyle: item.value === "Not provided" ? "italic" : "normal",
                      }}>{item.value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Education */}
              {viewEducation.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#4f46e5", mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                      <SchoolOutlined sx={{ fontSize: 18 }} /> Education
                    </Typography>
                    <Grid container spacing={1.5}>
                      {viewEducation.map((edu) => (
                        <Grid size={{ xs: 12, sm: 4 }} key={edu.id}>
                          <Box sx={{ p: 1.5, bgcolor: "#f9fafb", borderRadius: 2, border: "1px solid #e5e7eb" }}>
                            <Chip label={edu.level} size="small" sx={{ mb: 1, fontWeight: 600 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{edu.institution || "—"}</Typography>
                            <Typography variant="caption" sx={{ color: "#6b7280" }}>Board: {edu.board || "—"}</Typography><br />
                            <Typography variant="caption" sx={{ color: "#6b7280" }}>Year: {edu.yearOfPassing || "—"}</Typography><br />
                            {edu.percentage && <Typography variant="caption" sx={{ color: "#6b7280" }}>Percentage: {edu.percentage}%</Typography>}
                            {edu.cgpa && <Typography variant="caption" sx={{ color: "#6b7280", ml: 1 }}>CGPA: {edu.cgpa}</Typography>}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </>
              )}

              {/* Documents */}
              {viewDocuments.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#4f46e5", mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                      <UploadFile sx={{ fontSize: 18 }} /> Documents
                    </Typography>
                    <Grid container spacing={1.5}>
                      {viewDocuments.map((doc) => {
                        const sysADoc = viewSystemADocs.find(d => d.type === doc.documentType);
                        const isPdf = sysADoc?.fileName?.toLowerCase().endsWith(".pdf");
                        const isImage = /\.(jpg|jpeg|png)$/i.test(sysADoc?.fileName || "");
                        return (
                          <Grid size={{ xs: 12, sm: 6 }} key={doc.id}>
                            <Box sx={{ p: 1.5, bgcolor: "#f9fafb", borderRadius: 2, border: "1px solid #e5e7eb" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                <CheckCircle sx={{ color: "#10b981", fontSize: 18 }} />
                                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                                  {doc.documentType.replace(/_/g, " ").toUpperCase()}
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 1 }}>
                                {doc.documentName || "Uploaded"}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <Button size="small" variant="outlined" startIcon={<Visibility sx={{ fontSize: 14 }} />}
                                  onClick={() => handleViewDoc(doc.documentType, viewEmployee.id)}
                                  sx={{ textTransform: "none", fontSize: 11, py: 0.25, px: 1, borderColor: "#4f46e5", color: "#4f46e5" }}>
                                  View
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<UploadFile sx={{ fontSize: 14 }} />}
                                  onClick={() => handleDownloadDoc(doc.documentType, viewEmployee.id, doc.documentName)}
                                  sx={{ textTransform: "none", fontSize: 11, py: 0.25, px: 1, borderColor: "#10b981", color: "#10b981" }}>
                                  Download
                                </Button>
                                <Button size="small" variant="outlined" color="error"
                                  onClick={() => handleDeleteDoc(doc.documentType, viewEmployee.id)}
                                  disabled={docDeleting === doc.documentType}
                                  sx={{ textTransform: "none", fontSize: 11, py: 0.25, px: 1 }}>
                                  {docDeleting === doc.documentType ? "..." : "Delete"}
                                </Button>
                              </Box>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setViewDialogOpen(false)} sx={{ textTransform: "none" }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog open={docPreviewOpen} onClose={() => { setDocPreviewOpen(false); URL.revokeObjectURL(docPreviewUrl); setDocPreviewUrl(null); }} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{docPreviewName.replace(/_/g, " ").toUpperCase()}</Typography>
          <IconButton onClick={() => { setDocPreviewOpen(false); URL.revokeObjectURL(docPreviewUrl); setDocPreviewUrl(null); }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: "flex", justifyContent: "center", bgcolor: "#f3f4f6", minHeight: 400 }}>
          {docPreviewUrl && docPreviewName.toLowerCase().includes("pdf") ? (
            <iframe src={docPreviewUrl} title="Document Preview" style={{ width: "100%", height: "70vh", border: "none" }} />
          ) : docPreviewUrl ? (
            <img src={docPreviewUrl} alt="Document Preview" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />
          ) : (
            <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmployeeDirectory;
