import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, CircularProgress, Snackbar, TextField, Tooltip } from "@mui/material";
import {
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  DeleteOutlineOutlined,
  Download as DownloadIcon,
  EditOutlined,
  Info as InfoIcon,
  ToggleOff,
  ToggleOn,
  Warning as WarningIcon,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import "./DepartmentManagement.css";
import http from "../../services/http";
import {
  ConfirmModal,
  CountBadge,
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

const statusOf = (dept) => String(dept?.status || "").toLowerCase();

const getAIColor = (type) => {
  if (type === "warning") return "#f59e0b";
  if (type === "success") return "#10b981";
  return "#3b82f6";
};

const getAIDescription = (type, message) => {
  if (typeof message !== "string" || !message) return "";
  if (message.includes("0 employees")) {
    return "Empty departments increase overhead. Consider merging or removing them.";
  }
  if (message.includes("overstaffed")) {
    return "Too many employees in one dept can cause inefficiency. Redistribute to other teams.";
  }
  if (message.includes("understaffed")) {
    return "Low headcount may cause burnout. Consider hiring more team members.";
  }
  if (message.includes("no designations")) {
    return "Without job titles, career paths are unclear. Define roles for better structure.";
  }
  if (message.includes("well-balanced")) {
    return "Your department structure looks healthy. Keep monitoring!";
  }
  return "";
};

function DepartmentManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiError, setAiError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAI, setShowAI] = useState(false);
  const [page, setPage] = useState(0);
  const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);
  const [confirm, setConfirm] = useState({ open: false, dept: null });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const [empHover, setEmpHover] = useState({});
  const [empLoading, setEmpLoading] = useState({});

  const showToast = (message, severity = "success") =>
    setToast({ open: true, message, severity });

  const fetchAll = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const [deptRes, aiRes] = await Promise.allSettled([
        http.get("/api/Department"),
        http.get("/api/Department/ai-suggestions"),
      ]);

      if (deptRes.status === "fulfilled") {
        setDepartments(Array.isArray(deptRes.value.data) ? deptRes.value.data : []);
      } else {
        throw deptRes.reason;
      }

      if (aiRes.status === "fulfilled") {
        setAiSuggestions(aiRes.value.data);
        setAiError(false);
      } else {
        setAiError(true);
      }
    } catch (error) {
      setToast({
        open: true,
        message: "Departments load nahi ho paye. Phir try karein.",
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
    fetchAll({ showLoader: true });
  }, [fetchAll]);

  useEffect(() => {
    setPage(0);
    setMobileVisible(MOBILE_BATCH);
  }, [search, filterStatus]);

  const searchedDepts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter(
      (dept) =>
        String(dept.name || "").toLowerCase().includes(query) ||
        String(dept.description || "").toLowerCase().includes(query)
    );
  }, [departments, search]);

  const counts = useMemo(
    () => ({
      all: searchedDepts.length,
      active: searchedDepts.filter((dept) => statusOf(dept) === "active").length,
      inactive: searchedDepts.filter((dept) => statusOf(dept) === "inactive").length,
    }),
    [searchedDepts]
  );

  const filteredDepts = useMemo(() => {
    if (filterStatus === "all") return searchedDepts;
    return searchedDepts.filter((dept) => statusOf(dept) === filterStatus.toLowerCase());
  }, [searchedDepts, filterStatus]);

  const pageCount = Math.max(1, Math.ceil(filteredDepts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedDepts = filteredDepts.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  const mobileDepts = filteredDepts.slice(0, mobileVisible);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const openCreate = () => {
    setEditingDept(null);
    setForm({ name: "", description: "" });
    setFormError("");
    setDrawerOpen(true);
  };

  const openEdit = (dept) => {
    setEditingDept(dept);
    setForm({ name: dept.name || "", description: dept.description || "" });
    setFormError("");
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("Department name zaroori hai.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editingDept) {
        await http.put(`/api/Department/${editingDept.id}`, {
          ...editingDept,
          name: form.name.trim(),
          description: form.description.trim(),
        });
      } else {
        await http.post("/api/Department", {
          name: form.name.trim(),
          description: form.description.trim(),
        });
      }
      setDrawerOpen(false);
      showToast(editingDept ? "Department updated." : "Department created.");
      fetchAll();
    } catch (error) {
      setFormError(
        error?.response?.data?.message || "Save nahi ho paya. Phir try karein."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (dept) => {
    try {
      await http.patch(`/api/Department/${dept.id}/toggle-status`);
      await fetchAll();
      showToast(
        `Department ${statusOf(dept) === "active" ? "deactivated" : "activated"}.`
      );
    } catch (error) {
      showToast("Status update nahi ho paya. Phir try karein.", "error");
    }
  };

  const askDelete = (dept) => setConfirm({ open: true, dept });

  const closeConfirm = () => {
    if (deleting) return;
    setConfirm({ open: false, dept: null });
  };

  const confirmDelete = async () => {
    const dept = confirm.dept;
    if (!dept || Number(dept.employeeCount || 0) > 0) return;

    setDeleting(true);
    try {
      await http.delete(`/api/Department/${dept.id}`);
      setConfirm({ open: false, dept: null });
      showToast(`${dept.name} deleted.`);
      fetchAll();
    } catch (error) {
      showToast("Delete nahi ho paya. Phir try karein.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const fetchDeptEmployees = async (deptId) => {
    if (empHover[deptId]) return;
    setEmpLoading((prev) => ({ ...prev, [deptId]: true }));
    try {
      const { data } = await http.get(`/api/Department/${deptId}/employees`);
      setEmpHover((prev) => ({ ...prev, [deptId]: Array.isArray(data) ? data : [] }));
    } catch (error) {
      setEmpHover((prev) => ({ ...prev, [deptId]: [] }));
    } finally {
      setEmpLoading((prev) => ({ ...prev, [deptId]: false }));
    }
  };

  const employeeTooltip = (dept) => {
    if (empLoading[dept.id]) {
      return (
        <span className="dept-tooltip is-inline">
          <CircularProgress size={14} /> Loading employees...
        </span>
      );
    }

    const list = empHover[dept.id];
    if (!list) return "Hover to load employees";
    if (list.length === 0) return "Is department mein koi employee nahi hai.";

    return (
      <span className="dept-tooltip">
        <strong>
          {dept.name} — {list.length} employee{list.length === 1 ? "" : "s"}
        </strong>
        {list.map((emp, index) => (
          <span key={`${emp.id ?? emp.firstName ?? "emp"}-${index}`}>
            {[emp.firstName, emp.lastName].filter(Boolean).join(" ")} —{" "}
            {emp.designationTitle || "No designation"}
          </span>
        ))}
      </span>
    );
  };

  const exportCSV = () => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = ["Name", "Description", "Employees", "Designations", "Status"];
    const rows = filteredDepts.map((dept) => [
      dept.name,
      dept.description || "",
      Number(dept.employeeCount || 0),
      Number(dept.designationCount || 0),
      dept.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `departments_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${filteredDepts.length} departments exported.`);
  };

  const departmentActions = (dept) => [
    {
      key: "toggle",
      label: statusOf(dept) === "active" ? "Deactivate" : "Activate",
      ariaLabel: `${statusOf(dept) === "active" ? "Deactivate" : "Activate"} ${dept.name}`,
      icon: statusOf(dept) === "active" ? ToggleOn : ToggleOff,
      onClick: () => handleToggleStatus(dept),
    },
    {
      key: "edit",
      label: "Edit",
      ariaLabel: `Edit ${dept.name}`,
      icon: EditOutlined,
      onClick: () => openEdit(dept),
    },
    {
      key: "delete",
      label: "Delete",
      ariaLabel: `Delete ${dept.name}`,
      icon: DeleteOutlineOutlined,
      tone: "danger",
      onClick: () => askDelete(dept),
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Department",
      render: (dept) => (
        <>
          <span className="admin-cell-primary">{dept.name}</span>
          <span className="admin-cell-sub">{dept.description || "No description"}</span>
        </>
      ),
    },
    {
      key: "employees",
      header: "Employees",
      render: (dept) => {
        const count = Number(dept.employeeCount || 0);
        return (
          <Tooltip
            arrow
            placement="top"
            onOpen={() => count > 0 && fetchDeptEmployees(dept.id)}
            title={employeeTooltip(dept)}
          >
            <span>
              <CountBadge
                value={count}
                label={count === 1 ? "employee" : "employees"}
                ariaLabel={`${count} employees in ${dept.name}`}
              />
            </span>
          </Tooltip>
        );
      },
    },
    {
      key: "designations",
      header: "Designations",
      render: (dept) => {
        const count = Number(dept.designationCount || 0);
        return (
          <CountBadge
            value={count}
            label={count === 1 ? "designation" : "designations"}
            ariaLabel={`${count} designations in ${dept.name}`}
          />
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (dept) => <StatusBadge status={dept.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (dept) => <RowActions actions={departmentActions(dept)} />,
    },
  ];

  const hasFilters = Boolean(search.trim()) || filterStatus !== "all";
  const emptyState = (
    <EmptyState
      title={hasFilters ? "Koi department nahi mili." : "Abhi koi department nahi hai."}
      subtitle={
        hasFilters
          ? "Search ya filter badal kar try karein."
          : "Pehla department add karke shuru karein."
      }
      action={
        !hasFilters ? (
          <button type="button" className="admin-btn is-primary-solid" onClick={openCreate}>
            Add Department
          </button>
        ) : null
      }
    />
  );

  return (
    <div className="dash-page admin-page-shell">
      <Sidebar
        activeKey="departments"
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
              title="Departments"
              subtitle="Manage organizational departments"
              actions={[
                {
                  key: "export",
                  label: "Export CSV",
                  icon: DownloadIcon,
                  onClick: exportCSV,
                },
                {
                  key: "ai",
                  label: showAI ? "Hide AI" : "AI Insights",
                  icon: AutoAwesomeIcon,
                  onClick: () => setShowAI((prev) => !prev),
                },
                {
                  key: "add",
                  label: "Add Department",
                  icon: AddIcon,
                  variant: "primary",
                  onClick: openCreate,
                },
              ]}
            />

            {showAI && (
              <section className="dept-ai-panel" aria-label="AI department insights">
                <div className="dept-ai-head">
                  <span className="dept-ai-head-icon">
                    <AutoAwesomeIcon fontSize="small" />
                  </span>
                  <div>
                    <h2>AI Department Insights</h2>
                    <p>Structure, workload aur role gaps ka quick analysis.</p>
                  </div>
                </div>

                {aiError ? (
                  <p className="dept-ai-summary">
                    AI insights abhi available nahi hain. Baad mein try karein.
                  </p>
                ) : !aiSuggestions ? (
                  <div className="dept-ai-loading">
                    <CircularProgress size={18} /> Analyzing departments...
                  </div>
                ) : (
                  <>
                    {aiSuggestions.summary && (
                      <p className="dept-ai-summary">{aiSuggestions.summary}</p>
                    )}
                    <div className="dept-ai-list">
                      {(aiSuggestions.suggestions || []).map((suggestion, index) => {
                        const color = getAIColor(suggestion.type);
                        const Icon =
                          suggestion.type === "warning"
                            ? WarningIcon
                            : suggestion.type === "success"
                            ? CheckCircleIcon
                            : InfoIcon;
                        const description = getAIDescription(
                          suggestion.type,
                          suggestion.message
                        );

                        return (
                          <div
                            key={`${suggestion.message || "suggestion"}-${index}`}
                            className="dept-ai-item"
                            style={{
                              backgroundColor: `${color}0d`,
                              borderColor: `${color}26`,
                            }}
                          >
                            <Icon sx={{ color, fontSize: 20, marginTop: "2px" }} />
                            <div className="dept-ai-item-body">
                              <p className="dept-ai-item-title">{suggestion.message}</p>
                              {description && (
                                <p className="dept-ai-item-desc">{description}</p>
                              )}
                              {suggestion.priority && (
                                <span className="dept-ai-priority">
                                  {suggestion.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            )}

            <div className="admin-toolbar">
              <div className="admin-toolbar-left">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search departments..."
                  ariaLabel="Search departments"
                />
              </div>
              <div className="admin-toolbar-right">
                <FilterPills
                  ariaLabel="Filter departments by status"
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
              ariaLabel="Departments"
              columns={columns}
              rows={pagedDepts}
              rowKey="id"
              loading={loading}
              skeletonRows={PAGE_SIZE}
              empty={emptyState}
            />

            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredDepts.length}
              onPageChange={setPage}
            />

            <MobileCardList
              items={mobileDepts}
              loading={loading}
              getKey={(dept) => dept.id}
              hasMore={filteredDepts.length > mobileVisible}
              onLoadMore={() => setMobileVisible((prev) => prev + MOBILE_BATCH)}
              empty={emptyState}
              renderItem={(dept) => (
                <MobileCard
                  title={dept.name}
                  subtitle={dept.description || "No description"}
                  badge={<StatusBadge status={dept.status} />}
                  fields={[
                    { label: "Employees", value: Number(dept.employeeCount || 0) },
                    {
                      label: "Designations",
                      value: Number(dept.designationCount || 0),
                    },
                  ]}
                  actions={departmentActions(dept)}
                  ariaLabel={`${dept.name} department`}
                />
              )}
            />
          </div>
        </div>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={editingDept ? "Edit Department" : "Add Department"}
        submitLabel={editingDept ? "Update" : "Create"}
        saving={saving}
        error={formError}
        onClose={() => {
          if (!saving) setDrawerOpen(false);
        }}
        onSubmit={handleSave}
      >
        <div className="admin-form">
          <TextField
            label="Department name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            fullWidth
            size="small"
            autoFocus
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            fullWidth
            size="small"
            multiline
            rows={4}
          />
        </div>
      </FormDrawer>

      <ConfirmModal
        open={confirm.open}
        title={confirm.dept ? `Delete ${confirm.dept.name}` : "Delete department"}
        message="Ye wapas nahi hoga."
        blocked={Number(confirm.dept?.employeeCount || 0) > 0}
        blockedMessage={
          confirm.dept
            ? `Is department mein ${Number(confirm.dept.employeeCount || 0)} employee${
                Number(confirm.dept.employeeCount || 0) === 1 ? "" : "s"
              } hain. Pehle unhe doosri department mein move ya remove karein.`
            : ""
        }
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

export default DepartmentManagement;
