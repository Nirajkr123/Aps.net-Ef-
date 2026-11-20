import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Add as AddIcon,
  DeleteOutlineOutlined,
  EditOutlined,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import http from "../../services/http";
import {
  ConfirmModal,
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

const PAGE_SIZE = 10;
const MOBILE_BATCH = 5;

const statusOf = (item) => String(item?.status || "").toLowerCase();

function DesignationManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", departmentId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);
  const [confirm, setConfirm] = useState({ open: false, item: null });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const showToast = (message, severity = "success") =>
    setToast({ open: true, message, severity });

  const fetchData = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const [desRes, deptRes] = await Promise.allSettled([
        http.get("/api/Designation"),
        http.get("/api/Department"),
      ]);

      if (desRes.status === "fulfilled") {
        setDesignations(Array.isArray(desRes.value.data) ? desRes.value.data : []);
      } else {
        throw desRes.reason;
      }

      if (deptRes.status === "fulfilled") {
        setDepartments(Array.isArray(deptRes.value.data) ? deptRes.value.data : []);
      }
    } catch (error) {
      setToast({
        open: true,
        message: "Designations load nahi ho payi. Phir try karein.",
        severity: "error",
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("user") || "null"));
    } catch {
      setUser(null);
    }
    fetchData({ showLoader: true });
  }, [fetchData]);

  useEffect(() => {
    setPage(0);
    setMobileVisible(MOBILE_BATCH);
  }, [search, filterStatus]);

  const departmentNames = useMemo(() => {
    const map = new Map();
    departments.forEach((dept) => map.set(String(dept.id), dept.name));
    return map;
  }, [departments]);

  const getDepartmentName = useCallback(
    (item) =>
      item.departmentName ||
      departmentNames.get(String(item.departmentId)) ||
      "No department",
    [departmentNames]
  );

  const searchedDesignations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return designations;
    return designations.filter(
      (item) =>
        String(item.title || "").toLowerCase().includes(query) ||
        getDepartmentName(item).toLowerCase().includes(query)
    );
  }, [designations, search, getDepartmentName]);

  const counts = useMemo(
    () => ({
      all: searchedDesignations.length,
      active: searchedDesignations.filter((item) => statusOf(item) === "active").length,
      inactive: searchedDesignations.filter((item) => statusOf(item) === "inactive").length,
    }),
    [searchedDesignations]
  );

  const filtered = useMemo(() => {
    if (filterStatus === "all") return searchedDesignations;
    return searchedDesignations.filter(
      (item) => statusOf(item) === filterStatus.toLowerCase()
    );
  }, [searchedDesignations, filterStatus]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  const mobileItems = filtered.slice(0, mobileVisible);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", departmentId: "" });
    setFormError("");
    setDrawerOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      departmentId:
        item.departmentId != null && item.departmentId !== ""
          ? Number(item.departmentId)
          : "",
    });
    setFormError("");
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.departmentId) {
      setFormError("Title aur department dono zaroori hain.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const body = {
        title: form.title.trim(),
        departmentId: Number(form.departmentId),
      };

      if (editing) {
        await http.put(`/api/Designation/${editing.id}`, body);
      } else {
        await http.post("/api/Designation", body);
      }

      setDrawerOpen(false);
      showToast(editing ? "Designation updated." : "Designation created.");
      fetchData();
    } catch (error) {
      setFormError(
        error?.response?.data?.message || "Save nahi ho paya. Phir try karein."
      );
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (item) => setConfirm({ open: true, item });

  const closeConfirm = () => {
    if (deleting) return;
    setConfirm({ open: false, item: null });
  };

  const confirmDelete = async () => {
    const item = confirm.item;
    if (!item) return;

    setDeleting(true);
    try {
      await http.delete(`/api/Designation/${item.id}`);
      setConfirm({ open: false, item: null });
      showToast(`${item.title} deleted.`);
      fetchData();
    } catch (error) {
      showToast("Delete nahi ho paya. Phir try karein.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const rowActions = (item) => [
    {
      key: "edit",
      label: "Edit",
      ariaLabel: `Edit ${item.title}`,
      icon: EditOutlined,
      onClick: () => openEdit(item),
    },
    {
      key: "delete",
      label: "Delete",
      ariaLabel: `Delete ${item.title}`,
      icon: DeleteOutlineOutlined,
      tone: "danger",
      onClick: () => askDelete(item),
    },
  ];

  const columns = [
    {
      key: "title",
      header: "Designation",
      render: (item) => (
        <>
          <span className="admin-cell-primary">{item.title}</span>
          <span className="admin-cell-sub">{getDepartmentName(item)}</span>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (item) => <RowActions actions={rowActions(item)} />,
    },
  ];

  const hasFilters = Boolean(search.trim()) || filterStatus !== "all";
  const emptyState = (
    <EmptyState
      title={hasFilters ? "Koi designation nahi mili." : "Abhi koi designation nahi hai."}
      subtitle={
        hasFilters
          ? "Search ya filter badal kar try karein."
          : "Pehli designation add karke shuru karein."
      }
      action={
        !hasFilters ? (
          <button type="button" className="admin-btn is-primary-solid" onClick={openCreate}>
            Add Designation
          </button>
        ) : null
      }
    />
  );

  return (
    <div className="dash-page admin-page-shell">
      <Sidebar
        activeKey="designations"
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
              title="Designations"
              subtitle="Manage job designations by department"
              actions={[
                {
                  key: "add",
                  label: "Add Designation",
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
                  placeholder="Search designations..."
                  ariaLabel="Search designations"
                />
              </div>
              <div className="admin-toolbar-right">
                <FilterPills
                  ariaLabel="Filter designations by status"
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { key: "all", label: "All", count: counts.all },
                    { key: "Active", label: "Active", count: counts.active },
                    { key: "Inactive", label: "Inactive", count: counts.inactive },
                  ]}
                />
              </div>
            </div>

            <DataTable
              ariaLabel="Designations"
              columns={columns}
              rows={pagedItems}
              rowKey="id"
              loading={loading}
              skeletonRows={PAGE_SIZE}
              empty={emptyState}
            />

            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />

            <MobileCardList
              items={mobileItems}
              loading={loading}
              getKey={(item) => item.id}
              hasMore={filtered.length > mobileVisible}
              onLoadMore={() => setMobileVisible((prev) => prev + MOBILE_BATCH)}
              empty={emptyState}
              renderItem={(item) => (
                <MobileCard
                  title={item.title}
                  subtitle={getDepartmentName(item)}
                  badge={<StatusBadge status={item.status} />}
                  actions={rowActions(item)}
                  ariaLabel={`${item.title} designation`}
                />
              )}
            />
          </div>
        </div>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={editing ? "Edit Designation" : "Add Designation"}
        submitLabel={editing ? "Update" : "Create"}
        saving={saving}
        error={formError}
        onClose={() => {
          if (!saving) setDrawerOpen(false);
        }}
        onSubmit={handleSave}
      >
        <div className="admin-form">
          <TextField
            label="Designation title"
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
            fullWidth
            size="small"
            autoFocus
          />
          <FormControl fullWidth size="small">
            <InputLabel id="designation-department-label">Department</InputLabel>
            <Select
              labelId="designation-department-label"
              label="Department"
              value={form.departmentId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, departmentId: event.target.value }))
              }
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </FormDrawer>

      <ConfirmModal
        open={confirm.open}
        title={confirm.item ? `Delete ${confirm.item.title}` : "Delete designation"}
        message="Ye wapas nahi hoga."
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={closeConfirm}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ borderRadius: "12px" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default DesignationManagement;
