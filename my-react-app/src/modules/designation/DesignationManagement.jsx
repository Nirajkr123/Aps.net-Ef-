import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Paper, Chip, Box, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { Add, Close, EditOutlined, DeleteOutlineOutlined } from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";

import http from "../../services/http";

function DesignationManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", departmentId: "" });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      setUser(stored);
    } catch { setUser(null); }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [desRes, deptRes] = await Promise.all([
        http.get("/api/Designation"),
        http.get("/api/Department"),
      ]);
      setDesignations(desRes.data);
      setDepartments(deptRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const openCreate = () => { setEditing(null); setForm({ title: "", departmentId: "" }); setDialogOpen(true); };
  const openEdit = (des) => { setEditing(des); setForm({ title: des.title, departmentId: des.departmentId }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.departmentId) return;
    setSaving(true);
    try {
      const body = { title: form.title, departmentId: parseInt(form.departmentId) };
      if (editing) {
        await http.put(`/api/Designation/${editing.id}`, body);
      } else {
        await http.post("/api/Designation", body);
      }
      setDialogOpen(false);
      fetchData();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this designation?")) return;
    try {
      await http.delete(`/api/Designation/${id}`);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const pagedDesignations = designations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <div className="dash-page">
      <Sidebar activeKey="designations" onLogout={handleLogout} title="HRMS" user={user} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
        <Navbar userName={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin"} userRole={user?.role || "OWNER"} user={user} onLogout={handleLogout} collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
        <div className="dash-content">
          <div className="dash-header">
            <div>
              <h1 className="dash-title">Designations</h1>
              <p className="dash-subtitle">Manage job designations by department</p>
            </div>
            <Button variant="contained" startIcon={<Add />} onClick={openCreate}
              sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
              Add Designation
            </Button>
          </div>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} className="desig-table" sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f9fafb" }}>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedDesignations.map((des, idx) => (
                    <TableRow key={des.id} hover>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{des.title}</TableCell>
                      <TableCell>{des.departmentName}</TableCell>
                      <TableCell><Chip label={des.status} size="small" color={des.status === "Active" ? "success" : "default"} variant="outlined" /></TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => openEdit(des)}><EditOutlined fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(des.id)}><DeleteOutlineOutlined fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {designations.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: "#9ca3af" }}>No designations found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && (
            <>
              <div className="desig-cards">
                {pagedDesignations.map((des) => (
                  <div key={des.id} className="desig-card">
                    <div className="desig-card-head">
                      <div className="desig-card-title-wrap">
                        <h3 className="desig-card-title">{des.title}</h3>
                        <p className="desig-card-sub">{des.departmentName || "No department"}</p>
                      </div>
                      <Chip
                        label={des.status}
                        size="small"
                        color={des.status === "Active" ? "success" : "default"}
                        variant="outlined"
                      />
                    </div>
                    <div className="desig-card-actions">
                      <IconButton size="small" onClick={() => openEdit(des)} aria-label="Edit designation">
                        <EditOutlined fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(des.id)} aria-label="Delete designation">
                        <DeleteOutlineOutlined fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                ))}
                {designations.length === 0 && (
                  <div className="desig-cards-empty">No designations found</div>
                )}
              </div>

              <TablePagination
                component="div"
                count={designations.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? "Edit Designation" : "Add Designation"}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: "absolute", right: 8, top: 8 }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField label="Designation Title" fullWidth margin="normal" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          <FormControl fullWidth margin="normal">
            <InputLabel>Department</InputLabel>
            <Select value={form.departmentId} label="Department" onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              {departments.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title.trim() || !form.departmentId}
            sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
            {saving ? <CircularProgress size={20} /> : editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default DesignationManagement;
