import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import {
  AccessTime,
  Add as AddIcon,
  CheckCircle,
  Close,
  DeleteOutlineOutlined,
  Download as DownloadIcon,
  EditOutlined,
  FamilyRestroom,
  Person,
  PersonOff,
  PhoneOutlined,
  SchoolOutlined,
  UploadFile,
  Visibility,
} from "@mui/icons-material";

import Sidebar from "../../Admin/Sidebar";
import Navbar from "../../Admin/Navbar";
import "../../Admin/AdminDashboard.css";
import "./EmployeeDirectory.css";
import employeeServ from "../../services/employeeService";
import educationServ from "../../services/educationService";
import documentServ from "../../services/documentService";
import attendanceServ from "../../services/attendanceService";
import AttendanceMapLink from "../../components/AttendanceMapLink";
import http from "../../services/http";
import { useLeave } from "../../context/LeaveContext";
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

const EMPLOYMENT_LABELS = {
  FULL_TIME: "Full Time",
  CONTRACT: "Contract",
  INTERN: "Intern",
};

const blankForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  departmentId: "",
  designationId: "",
  employmentType: "FULL_TIME",
  joiningDate: "",
};

const toInputDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatAttendanceTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatAttendanceDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const attendanceHours = (row) => {
  if (row.workingHours != null && Number(row.workingHours) > 0) {
    return `${Number(row.workingHours).toFixed(2)} h`;
  }
  if (row.checkInTime && row.checkOutTime) {
    const diff = new Date(row.checkOutTime) - new Date(row.checkInTime);
    if (diff > 0) {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return `${hrs}h ${String(mins).padStart(2, "0")}m`;
    }
  }
  return "—";
};

const attendanceStatusMap = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "present":
      return { status: "Active", label: status };
    case "late":
      return { status: "Pending", label: status };
    case "absent":
      return { status: "Inactive", label: status };
    case "half-day":
      return { status: "Published", label: status };
    default:
      return { status: "Neutral", label: status || "—" };
  }
};

const statusOf = (employee) => String(employee?.status || "").toLowerCase();

const fullName = (employee) =>
  [employee?.firstName, employee?.lastName].filter(Boolean).join(" ").trim() ||
  "Unnamed employee";

const initialsOf = (employee) => {
  const first = (employee?.firstName || "").trim().charAt(0);
  const last = (employee?.lastName || "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
};

const employmentLabel = (value) =>
  EMPLOYMENT_LABELS[String(value || "").toUpperCase()] ||
  (value ? String(value).replace(/_/g, " ") : "—");

const isOnLeaveToday = (leave, todayISO) =>
  leave.status === "Approved" &&
  leave.from &&
  leave.to &&
  leave.from <= todayISO &&
  todayISO <= leave.to;

const DetailItem = ({ label, value, empty = false }) => (
  <div className="emp-detail-item">
    <span>{label}</span>
    <strong className={empty ? "is-empty" : undefined}>
      {empty ? value || "Not provided" : value || "—"}
    </strong>
  </div>
);

function EmployeeDirectory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { leaves } = useLeave();

  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [viewEducation, setViewEducation] = useState([]);
  const [viewDocuments, setViewDocuments] = useState([]);
  const [viewTodayAttendance, setViewTodayAttendance] = useState(null);
  const [viewTodayLoading, setViewTodayLoading] = useState(false);

  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [docPreviewUrl, setDocPreviewUrl] = useState(null);
  const [docPreviewName, setDocPreviewName] = useState("");
  const [docDeleting, setDocDeleting] = useState(null);
  const [docConfirm, setDocConfirm] = useState({ open: false, docType: null });

  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceEmployee, setAttendanceEmployee] = useState(null);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceFrom, setAttendanceFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return toInputDate(date);
  });
  const [attendanceTo, setAttendanceTo] = useState(() => toInputDate(new Date()));

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

  const todayISO = useMemo(() => toInputDate(new Date()), []);

  const onLeaveIds = useMemo(() => {
    const ids = new Set();
    (leaves || []).forEach((leave) => {
      if (isOnLeaveToday(leave, todayISO)) ids.add(String(leave.employeeId));
    });
    return ids;
  }, [leaves, todayISO]);

  const fetchAll = useCallback(
    async ({ showLoader = false } = {}) => {
      if (showLoader) setLoading(true);
      try {
        const [empRes, deptRes, desRes] = await Promise.allSettled([
          employeeServ.getAll(),
          http.get("/api/Department"),
          http.get("/api/Designation"),
        ]);

        if (empRes.status === "fulfilled") {
          const data = empRes.value?.data;
          setEmployees(Array.isArray(data) ? data : []);
        } else {
          throw empRes.reason;
        }

        if (deptRes.status === "fulfilled") {
          const data = deptRes.value?.data;
          setDepartments(Array.isArray(data) ? data : []);
        }

        if (desRes.status === "fulfilled") {
          const data = desRes.value?.data;
          setDesignations(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        setToast({
          open: true,
          message: "Employees load nahi ho paye. Phir try karein.",
          severity: "error",
        });
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    []
  );

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
  }, [search, filter, filterDept]);

  const searchedEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (
        filterDept &&
        String(employee.departmentId) !== String(filterDept)
      ) {
        return false;
      }
      if (!query) return true;

      const haystack = [
        `${employee.firstName || ""} ${employee.lastName || ""}`,
        employee.email,
        employee.employeeCode,
        employee.departmentName,
        employee.designationTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [employees, search, filterDept]);

  const counts = useMemo(
    () => ({
      all: searchedEmployees.length,
      active: searchedEmployees.filter((employee) => statusOf(employee) === "active")
        .length,
      inactive: searchedEmployees.filter(
        (employee) => statusOf(employee) === "inactive"
      ).length,
      onleave: searchedEmployees.filter((employee) =>
        onLeaveIds.has(String(employee.id))
      ).length,
      complete: searchedEmployees.filter((employee) => employee.profileComplete)
        .length,
    }),
    [searchedEmployees, onLeaveIds]
  );

  const filteredEmployees = useMemo(() => {
    switch (filter) {
      case "active":
        return searchedEmployees.filter(
          (employee) => statusOf(employee) === "active"
        );
      case "inactive":
        return searchedEmployees.filter(
          (employee) => statusOf(employee) === "inactive"
        );
      case "onleave":
        return searchedEmployees.filter((employee) =>
          onLeaveIds.has(String(employee.id))
        );
      case "complete":
        return searchedEmployees.filter((employee) => employee.profileComplete);
      default:
        return searchedEmployees;
    }
  }, [searchedEmployees, filter, onLeaveIds]);

  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedEmployees = filteredEmployees.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  const mobileEmployees = filteredEmployees.slice(0, mobileVisible);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(blankForm);
    setErrors({});
    setFormError("");
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    if (!location.state?.openAddEmployee) return;
    openCreate();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, openCreate]);

  const openEdit = (employee) => {
    setEditing(employee);
    setForm({
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      email: employee.email || "",
      phone: employee.phone || "",
      address: employee.address || "",
      departmentId:
        employee.departmentId != null ? employee.departmentId : "",
      designationId:
        employee.designationId != null ? employee.designationId : "",
      employmentType: employee.employmentType || "FULL_TIME",
      joiningDate: employee.joiningDate
        ? String(employee.joiningDate).split("T")[0]
        : "",
    });
    setErrors({});
    setFormError("");
    setDrawerOpen(true);
  };

  const validate = () => {
    const next = {};

    if (!form.firstName.trim()) next.firstName = "First name is required";
    else if (form.firstName.trim().length < 2)
      next.firstName = "First name must be at least 2 characters";

    if (!form.lastName.trim()) next.lastName = "Last name is required";

    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address";

    if (!form.phone.trim()) next.phone = "Phone number is required";
    else if (!/^[0-9+\-\s()]{7,15}$/.test(form.phone))
      next.phone = "Enter a valid phone number (7-15 digits)";

    if (!form.departmentId) next.departmentId = "Department is required";
    if (!form.designationId) next.designationId = "Designation is required";
    if (!form.employmentType) next.employmentType = "Employment type is required";
    if (!form.joiningDate) next.joiningDate = "Joining date is required";

    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError("Please fill all required fields correctly.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setFormError("");
    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        employmentType: form.employmentType,
        departmentId: form.departmentId ? parseInt(form.departmentId, 10) : null,
        designationId: form.designationId
          ? parseInt(form.designationId, 10)
          : null,
        joiningDate: form.joiningDate || null,
      };

      if (editing) {
        await employeeServ.update(editing.id, body);
        showToast("Employee details updated.");
      } else {
        const { data: result } = await employeeServ.create(body);
        if (result?.tempPassword) {
          setSuccessInfo({
            name: `${body.firstName} ${body.lastName}`,
            email: body.email,
            password: result.tempPassword,
            employeeCode: result.employeeCode,
          });
        } else {
          showToast("Employee created.");
        }
      }

      setDrawerOpen(false);
      fetchAll();
      setPage(0);
    } catch (error) {
      setFormError(
        error?.response?.data?.message || "Save nahi ho paya. Phir try karein."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (employee) => {
    const action = employee.status === "Active" ? "deactivate" : "activate";
    try {
      await employeeServ.toggleAction(employee.id, action);
      showToast(
        action === "deactivate" ? "Employee deactivated." : "Employee activated."
      );
      fetchAll();
    } catch (error) {
      showToast("Status update nahi ho paya. Phir try karein.", "error");
    }
  };

  const openView = async (employee) => {
    setViewEmployee(employee);
    setViewOpen(true);
    setViewEducation([]);
    setViewDocuments([]);
    setViewTodayAttendance(null);
    setViewTodayLoading(true);

    const today = toInputDate(new Date());
    try {
      const [educationRes, documentRes, todayRes] = await Promise.all([
        educationServ.getByEmployee(employee.id),
        documentServ.getByEmployee(employee.id),
        attendanceServ
          .getAll({ employeeId: employee.id, fromDate: today, toDate: today })
          .catch(() => ({ data: [] })),
      ]);

      setViewEducation(Array.isArray(educationRes.data) ? educationRes.data : []);
      setViewDocuments(Array.isArray(documentRes.data) ? documentRes.data : []);
      setViewTodayAttendance(
        Array.isArray(todayRes.data) ? todayRes.data[0] || null : null
      );
    } catch (error) {
      showToast("Employee details load nahi ho payi.", "error");
    } finally {
      setViewTodayLoading(false);
    }
  };

  const closeView = () => {
    setViewOpen(false);
    setViewEmployee(null);
  };

  const openAttendanceHistory = (employee) => {
    setAttendanceEmployee(employee);
    setAttendanceOpen(true);
  };

  useEffect(() => {
    if (!attendanceOpen || !attendanceEmployee) return undefined;

    let cancelled = false;
    setAttendanceLoading(true);
    setAttendanceError("");

    attendanceServ
      .getAll({
        employeeId: attendanceEmployee.id,
        fromDate: attendanceFrom,
        toDate: attendanceTo,
      })
      .then(({ data }) => {
        if (!cancelled) setAttendanceRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setAttendanceRows([]);
          setAttendanceError("Could not load attendance history. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setAttendanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attendanceOpen, attendanceEmployee, attendanceFrom, attendanceTo]);

  const openDocPreview = async (docType, employeeId) => {
    try {
      const res = await http.get(
        `/api/Document/view-by-employee?employeeId=${employeeId}&documentType=${docType}`,
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      setDocPreviewUrl(URL.createObjectURL(blob));
      setDocPreviewName(docType);
      setDocPreviewOpen(true);
    } catch (error) {
      showToast("Document open nahi ho paya.", "error");
    }
  };

  const closeDocPreview = () => {
    setDocPreviewOpen(false);
    if (docPreviewUrl) URL.revokeObjectURL(docPreviewUrl);
    setDocPreviewUrl(null);
    setDocPreviewName("");
  };

  const downloadDoc = async (docType, employeeId, fileName) => {
    try {
      const res = await http.get(
        `/api/Document/view-by-employee?employeeId=${employeeId}&documentType=${docType}`,
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || `${docType}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast("Document download nahi ho paya.", "error");
    }
  };

  const askDeleteDoc = (docType) =>
    setDocConfirm({ open: true, docType });

  const confirmDeleteDoc = async () => {
    const docType = docConfirm.docType;
    if (!docType || !viewEmployee) return;

    setDocDeleting(docType);
    try {
      await documentServ.removeByType(viewEmployee.id, docType);
      setViewDocuments((prev) =>
        prev.filter((doc) => doc.documentType !== docType)
      );
      setDocConfirm({ open: false, docType: null });
      showToast("Document deleted.");
    } catch (error) {
      showToast("Document delete nahi ho paya.", "error");
    } finally {
      setDocDeleting(null);
    }
  };

  const rowActions = (employee) => {
    const guard = (fn) => (event) => {
      event?.stopPropagation?.();
      fn();
    };

    return [
      {
        key: "attendance",
        label: "Attendance history",
        ariaLabel: `Attendance history for ${fullName(employee)}`,
        icon: AccessTime,
        onClick: guard(() => openAttendanceHistory(employee)),
      },
      {
        key: "view",
        label: "View details",
        ariaLabel: `View ${fullName(employee)}`,
        icon: Visibility,
        onClick: guard(() => openView(employee)),
      },
      {
        key: "edit",
        label: "Edit",
        ariaLabel: `Edit ${fullName(employee)}`,
        icon: EditOutlined,
        onClick: guard(() => openEdit(employee)),
      },
      {
        key: "toggle",
        label: employee.status === "Active" ? "Deactivate" : "Activate",
        ariaLabel:
          employee.status === "Active"
            ? `Deactivate ${fullName(employee)}`
            : `Activate ${fullName(employee)}`,
        icon: employee.status === "Active" ? PersonOff : Person,
        tone: employee.status === "Active" ? "danger" : undefined,
        onClick: guard(() => toggleStatus(employee)),
      },
    ];
  };

  const columns = [
    {
      key: "employee",
      header: "Employee",
      render: (employee) => (
        <span className="emp-person">
          <span className="emp-avatar" aria-hidden="true">
            {initialsOf(employee)}
          </span>
          <span className="emp-person-copy">
            <span className="admin-cell-primary">{fullName(employee)}</span>
            <span className="admin-cell-sub">{employee.email || "No email"}</span>
          </span>
        </span>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (employee) =>
        employee.employeeCode ? (
          <CountBadge value={employee.employeeCode} />
        ) : (
          <span className="emp-muted">—</span>
        ),
    },
    {
      key: "department",
      header: "Department",
      render: (employee) => (
        <>
          <span className="admin-cell-primary">
            {employee.departmentName || "—"}
          </span>
          <span className="admin-cell-sub">
            {employee.designationTitle || "No designation"}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (employee) => <StatusBadge status={employee.status} />,
    },
    {
      key: "profile",
      header: "Profile",
      render: (employee) => (
        <StatusBadge
          status={employee.profileComplete ? "Active" : "Pending"}
          label={employee.profileComplete ? "Complete" : "Pending"}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (employee) => <RowActions actions={rowActions(employee)} />,
    },
  ];

  const hasFilters =
    Boolean(search.trim()) || filter !== "all" || Boolean(filterDept);

  const resetFilters = () => {
    setSearch("");
    setFilterDept("");
    setFilter("all");
  };

  const emptyState = (
    <EmptyState
      title={
        hasFilters
          ? "Koi employee nahi mila."
          : "Abhi koi employee add nahi hua hai."
      }
      subtitle={
        hasFilters
          ? "Search, department ya filter badal kar try karein."
          : "Pehla employee add karke directory shuru karein."
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
        ) : (
          <button
            type="button"
            className="admin-btn is-primary-solid"
            onClick={openCreate}
          >
            Add Employee
          </button>
        )
      }
    />
  );

  const todayCheckInLocation =
    viewTodayAttendance?.checkInLocationId &&
    viewTodayAttendance?.checkInLocationName
      ? viewTodayAttendance.checkInLocationName
      : "—";
  const todayCheckOutLocation =
    viewTodayAttendance?.checkOutLocationId &&
    viewTodayAttendance?.checkOutLocationName
      ? viewTodayAttendance.checkOutLocationName
      : "—";

  return (
    <div className="dash-page admin-page-shell">
      <Sidebar
        activeKey="directory"
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
              title="Employee Directory"
              subtitle="Manage team profiles, records and attendance"
              actions={[
                {
                  key: "add",
                  label: "Add Employee",
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
                  placeholder="Search name, email, code..."
                  ariaLabel="Search employees"
                />
                <FormControl
                  size="small"
                  className="emp-toolbar-select"
                  sx={{ minWidth: 170 }}
                >
                  <InputLabel id="employee-department-filter">
                    Department
                  </InputLabel>
                  <Select
                    labelId="employee-department-filter"
                    label="Department"
                    value={filterDept}
                    onChange={(event) => setFilterDept(event.target.value)}
                  >
                    <MenuItem value="">All departments</MenuItem>
                    {departments.map((department) => (
                      <MenuItem key={department.id} value={department.id}>
                        {department.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div className="admin-toolbar-right">
                <FilterPills
                  ariaLabel="Filter employees"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { key: "all", label: "All", count: counts.all },
                    { key: "active", label: "Active", count: counts.active },
                    {
                      key: "inactive",
                      label: "Inactive",
                      count: counts.inactive,
                    },
                    {
                      key: "onleave",
                      label: "On leave",
                      count: counts.onleave,
                    },
                    {
                      key: "complete",
                      label: "Complete",
                      count: counts.complete,
                    },
                  ]}
                />
              </div>
            </div>

            <DataTable
              ariaLabel="Employees"
              columns={columns}
              rows={pagedEmployees}
              rowKey="id"
              loading={loading}
              skeletonRows={PAGE_SIZE}
              empty={emptyState}
              onRowClick={(employee) => openAttendanceHistory(employee)}
            />

            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredEmployees.length}
              onPageChange={setPage}
            />

            <MobileCardList
              items={mobileEmployees}
              loading={loading}
              getKey={(employee) => employee.id}
              hasMore={filteredEmployees.length > mobileVisible}
              onLoadMore={() =>
                setMobileVisible((prev) => prev + MOBILE_BATCH)
              }
              empty={emptyState}
              renderItem={(employee) => (
                <MobileCard
                  title={fullName(employee)}
                  subtitle={employee.email || "No email"}
                  badge={<StatusBadge status={employee.status} />}
                  fields={[
                    {
                      label: "Code",
                      value: employee.employeeCode || "—",
                    },
                    {
                      label: "Department",
                      value: employee.departmentName || "—",
                    },
                    {
                      label: "Designation",
                      value: employee.designationTitle || "—",
                    },
                    {
                      label: "Profile",
                      value: employee.profileComplete ? "Complete" : "Pending",
                    },
                  ]}
                  actions={rowActions(employee)}
                  ariaLabel={`${fullName(employee)} employee`}
                />
              )}
            />
          </div>
        </div>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={editing ? "Edit Employee" : "Add Employee"}
        submitLabel={editing ? "Update Employee" : "Create Employee"}
        saving={saving}
        error={formError}
        onClose={() => {
          if (!saving) setDrawerOpen(false);
        }}
        onSubmit={handleSave}
      >
        <div className="admin-form">
          {!editing && (
            <Alert severity="info" sx={{ borderRadius: "12px" }}>
              A user account will be auto-created with the default password{" "}
              <strong>Employee@123</strong>.
            </Alert>
          )}

          <div className="admin-form-row">
            <TextField
              label="First name"
              value={form.firstName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, firstName: event.target.value }))
              }
              error={Boolean(errors.firstName)}
              fullWidth
              size="small"
              autoFocus
            />
            <TextField
              label="Last name"
              value={form.lastName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, lastName: event.target.value }))
              }
              error={Boolean(errors.lastName)}
              fullWidth
              size="small"
            />
          </div>

          <div className="admin-form-row">
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              error={Boolean(errors.email)}
              disabled={Boolean(editing)}
              fullWidth
              size="small"
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              error={Boolean(errors.phone)}
              fullWidth
              size="small"
            />
          </div>

          <TextField
            label="Address"
            value={form.address}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, address: event.target.value }))
            }
            fullWidth
            size="small"
            multiline
            minRows={2}
          />

          <div className="admin-form-row">
            <FormControl
              fullWidth
              size="small"
              error={Boolean(errors.departmentId)}
            >
              <InputLabel id="employee-department-label">
                Department
              </InputLabel>
              <Select
                labelId="employee-department-label"
                label="Department"
                value={form.departmentId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    departmentId: event.target.value,
                  }))
                }
              >
                {departments.map((department) => (
                  <MenuItem key={department.id} value={department.id}>
                    {department.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl
              fullWidth
              size="small"
              error={Boolean(errors.designationId)}
            >
              <InputLabel id="employee-designation-label">
                Designation
              </InputLabel>
              <Select
                labelId="employee-designation-label"
                label="Designation"
                value={form.designationId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    designationId: event.target.value,
                  }))
                }
              >
                {designations.map((designation) => (
                  <MenuItem key={designation.id} value={designation.id}>
                    {designation.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <div className="admin-form-row">
            <FormControl
              fullWidth
              size="small"
              error={Boolean(errors.employmentType)}
            >
              <InputLabel id="employee-employment-label">
                Employment type
              </InputLabel>
              <Select
                labelId="employee-employment-label"
                label="Employment type"
                value={form.employmentType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    employmentType: event.target.value,
                  }))
                }
              >
                <MenuItem value="FULL_TIME">Full Time</MenuItem>
                <MenuItem value="CONTRACT">Contract</MenuItem>
                <MenuItem value="INTERN">Intern</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Joining date"
              type="date"
              value={form.joiningDate}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  joiningDate: event.target.value,
                }))
              }
              error={Boolean(errors.joiningDate)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </div>
        </div>
      </FormDrawer>

      <Dialog
        open={Boolean(successInfo)}
        onClose={() => {
          setSuccessInfo(null);
          fetchAll();
          setPage(0);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden" } }}
      >
        <div className="emp-success-head">
          <span className="emp-success-icon">
            <CheckCircle />
          </span>
          <div>
            <h2>Employee created</h2>
            <p>Share the login credentials with the new team member.</p>
          </div>
        </div>
        <DialogContent sx={{ p: 3, bgcolor: "#f8f9fc" }}>
          <Alert severity="success" sx={{ borderRadius: "12px", mb: 2 }}>
            <strong>{successInfo?.name}</strong> has been added as{" "}
            <strong>{successInfo?.employeeCode || "employee"}</strong>.
          </Alert>
          <div className="emp-credential-card">
            <span className="emp-credential-title">Login credentials</span>
            <div>
              <span>Email</span>
              <strong>{successInfo?.email}</strong>
            </div>
            <div>
              <span>Password</span>
              <strong>{successInfo?.password}</strong>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, bgcolor: "#f8f9fc" }}>
          <button
            type="button"
            className="admin-btn is-primary-solid"
            onClick={() => {
              setSuccessInfo(null);
              fetchAll();
              setPage(0);
            }}
          >
            Got it
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={viewOpen}
        onClose={closeView}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden" } }}
      >
        {viewEmployee && (
          <div className="emp-detail-head">
            <span className="emp-detail-avatar">
              {initialsOf(viewEmployee)}
            </span>
            <div className="emp-detail-ident">
              <h2>{fullName(viewEmployee)}</h2>
              <p>{viewEmployee.email || "No email"}</p>
              <span className="emp-detail-code">
                {viewEmployee.employeeCode || "No code"}
              </span>
            </div>
            <div className="emp-detail-head-right">
              <StatusBadge
                status={viewEmployee.profileComplete ? "Active" : "Pending"}
                label={viewEmployee.profileComplete ? "Complete" : "Pending"}
              />
              <button
                type="button"
                className="emp-dialog-close"
                aria-label="Close employee details"
                onClick={closeView}
              >
                <Close fontSize="small" />
              </button>
            </div>
          </div>
        )}

        <DialogContent sx={{ p: { xs: 2, sm: 3 }, bgcolor: "#f8f9fc" }}>
          {viewEmployee && (
            <div className="emp-detail-stack">
              <section className="emp-detail-card">
                <header className="emp-detail-card-head">
                  <span className="emp-detail-card-icon">
                    <AccessTime fontSize="small" />
                  </span>
                  <h3>Today&apos;s attendance</h3>
                  {viewTodayLoading ? (
                    <CircularProgress size={18} sx={{ ml: "auto" }} />
                  ) : viewTodayAttendance ? (
                    <span className="emp-detail-head-badge">
                      <StatusBadge
                        {...attendanceStatusMap(viewTodayAttendance.status)}
                      />
                    </span>
                  ) : (
                    <span className="emp-detail-head-badge">
                      <StatusBadge status="Neutral" label="Not marked" />
                    </span>
                  )}
                </header>

                {viewTodayAttendance ? (
                  <div className="emp-attendance-pair">
                    <div>
                      <span className="emp-attendance-label">Check-in</span>
                      <strong>
                        {formatAttendanceTime(viewTodayAttendance.checkInTime)}
                      </strong>
                      <p>{todayCheckInLocation}</p>
                    </div>
                    <div>
                      <span className="emp-attendance-label">Check-out</span>
                      <strong>
                        {formatAttendanceTime(viewTodayAttendance.checkOutTime)}
                      </strong>
                      <p>{todayCheckOutLocation}</p>
                    </div>
                  </div>
                ) : (
                  <p className="emp-detail-note">
                    {viewTodayLoading
                      ? "Loading today's attendance..."
                      : "No check-in or check-out recorded today."}
                  </p>
                )}
              </section>

              <section className="emp-detail-card">
                <header className="emp-detail-card-head">
                  <span className="emp-detail-card-icon">
                    <Person fontSize="small" />
                  </span>
                  <h3>Basic information</h3>
                </header>
                <div className="emp-detail-grid">
                  <DetailItem
                    label="Employee code"
                    value={viewEmployee.employeeCode}
                  />
                  <DetailItem
                    label="Department"
                    value={viewEmployee.departmentName}
                  />
                  <DetailItem
                    label="Designation"
                    value={viewEmployee.designationTitle}
                  />
                  <DetailItem
                    label="Shift"
                    value={
                      viewEmployee.shiftName
                        ? `${viewEmployee.shiftName}${viewEmployee.shiftTiming ? ` (${viewEmployee.shiftTiming})` : ""}`
                        : "Not assigned"
                    }
                  />
                  <DetailItem
                    label="Employment type"
                    value={employmentLabel(viewEmployee.employmentType)}
                  />
                  <DetailItem label="Status" value={viewEmployee.status} />
                  <DetailItem
                    label="Joining date"
                    value={formatDate(viewEmployee.joiningDate)}
                  />
                </div>
              </section>

              <section className="emp-detail-card">
                <header className="emp-detail-card-head">
                  <span className="emp-detail-card-icon">
                    <FamilyRestroom fontSize="small" />
                  </span>
                  <h3>Personal information</h3>
                </header>
                <div className="emp-detail-grid">
                  <DetailItem
                    label="Father's name"
                    value={viewEmployee.fatherName}
                    empty
                  />
                  <DetailItem
                    label="Mother's name"
                    value={viewEmployee.motherName}
                    empty
                  />
                  <DetailItem
                    label="Gender"
                    value={viewEmployee.gender}
                    empty
                  />
                  <DetailItem
                    label="Date of birth"
                    value={
                      viewEmployee.dob
                        ? formatDate(viewEmployee.dob)
                        : "Not provided"
                    }
                    empty
                  />
                </div>
              </section>

              <section className="emp-detail-card">
                <header className="emp-detail-card-head">
                  <span className="emp-detail-card-icon">
                    <PhoneOutlined fontSize="small" />
                  </span>
                  <h3>Contact information</h3>
                </header>
                <div className="emp-detail-grid">
                  <DetailItem label="Phone" value={viewEmployee.phone} empty />
                  <DetailItem
                    label="Emergency contact"
                    value={viewEmployee.emergencyContact}
                    empty
                  />
                  <DetailItem
                    label="Address"
                    value={viewEmployee.address}
                    empty
                  />
                </div>
              </section>

              {viewEducation.length > 0 && (
                <section className="emp-detail-card">
                  <header className="emp-detail-card-head">
                    <span className="emp-detail-card-icon">
                      <SchoolOutlined fontSize="small" />
                    </span>
                    <h3>Education</h3>
                  </header>
                  <div className="emp-detail-tile-grid">
                    {viewEducation.map((education) => (
                      <article
                        className="emp-detail-tile"
                        key={education.id}
                      >
                        <CountBadge value={education.level || "—"} />
                        <strong>{education.institution || "—"}</strong>
                        <p>Board: {education.board || "—"}</p>
                        <p>Year: {education.yearOfPassing || "—"}</p>
                        {education.percentage != null && (
                          <p>Percentage: {education.percentage}%</p>
                        )}
                        {education.cgpa != null && (
                          <p>CGPA: {education.cgpa}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {viewDocuments.length > 0 && (
                <section className="emp-detail-card">
                  <header className="emp-detail-card-head">
                    <span className="emp-detail-card-icon">
                      <UploadFile fontSize="small" />
                    </span>
                    <h3>Documents</h3>
                  </header>
                  <div className="emp-detail-tile-grid">
                    {viewDocuments.map((doc) => (
                      <article className="emp-detail-tile" key={doc.id}>
                        <strong className="emp-doc-title">
                          {String(doc.documentType || "Document")
                            .replace(/_/g, " ")
                            .toUpperCase()}
                        </strong>
                        <p>{doc.documentName || "Uploaded"}</p>
                        <div className="emp-doc-actions">
                          <button
                            type="button"
                            className="admin-btn is-ghost-dark emp-doc-btn"
                            onClick={() =>
                              openDocPreview(
                                doc.documentType,
                                viewEmployee.id
                              )
                            }
                          >
                            <Visibility fontSize="small" /> View
                          </button>
                          <button
                            type="button"
                            className="admin-btn is-ghost-dark emp-doc-btn"
                            onClick={() =>
                              downloadDoc(
                                doc.documentType,
                                viewEmployee.id,
                                doc.documentName
                              )
                            }
                          >
                            <DownloadIcon fontSize="small" /> Download
                          </button>
                          <button
                            type="button"
                            className="admin-btn is-danger emp-doc-btn"
                            onClick={() => askDeleteDoc(doc.documentType)}
                            disabled={docDeleting === doc.documentType}
                          >
                            <DeleteOutlineOutlined fontSize="small" /> Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            bgcolor: "#ffffff",
            borderTop: "1px solid #eef0f6",
          }}
        >
          <button
            type="button"
            className="admin-btn is-ghost-dark"
            onClick={closeView}
          >
            Close
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={docPreviewOpen}
        onClose={closeDocPreview}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden" } }}
      >
        <div className="emp-dialog-head">
          <h2>{docPreviewName.replace(/_/g, " ").toUpperCase()}</h2>
          <button
            type="button"
            className="emp-dialog-close"
            aria-label="Close document preview"
            onClick={closeDocPreview}
          >
            <Close fontSize="small" />
          </button>
        </div>
        <DialogContent
          sx={{
            p: 0,
            display: "flex",
            justifyContent: "center",
            bgcolor: "#f3f4f6",
            minHeight: 400,
          }}
        >
          {docPreviewUrl && docPreviewName.toLowerCase().includes("pdf") ? (
            <iframe
              src={docPreviewUrl}
              title="Document preview"
              style={{ width: "100%", height: "70vh", border: "none" }}
            />
          ) : docPreviewUrl ? (
            <img
              src={docPreviewUrl}
              alt="Document preview"
              style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }}
            />
          ) : (
            <div className="emp-dialog-loading">
              <CircularProgress />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden" } }}
      >
        <div className="emp-dialog-head emp-attendance-head">
          <span className="emp-detail-card-icon is-teal">
            <AccessTime fontSize="small" />
          </span>
          <div>
            <h2>Check-in / check-out history</h2>
            {attendanceEmployee && (
              <p>
                {fullName(attendanceEmployee)}
                {attendanceEmployee.employeeCode
                  ? ` · ${attendanceEmployee.employeeCode}`
                  : ""}
                {attendanceEmployee.departmentName
                  ? ` · ${attendanceEmployee.departmentName}`
                  : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            className="emp-dialog-close"
            aria-label="Close attendance history"
            onClick={() => setAttendanceOpen(false)}
          >
            <Close fontSize="small" />
          </button>
        </div>

        <DialogContent sx={{ p: { xs: 2, sm: 3 }, bgcolor: "#f8f9fc" }}>
          <div className="emp-attendance-filters">
            <TextField
              label="From"
              type="date"
              size="small"
              value={attendanceFrom}
              onChange={(event) => setAttendanceFrom(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={attendanceTo}
              onChange={(event) => setAttendanceTo(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <div className="emp-attendance-summary">
              <CountBadge value={attendanceRows.length} label="records" />
              <CountBadge
                value={
                  attendanceRows.filter(
                    (row) => String(row.status || "").toLowerCase() === "present"
                  ).length
                }
                label="present"
              />
              <CountBadge
                value={
                  attendanceRows.filter(
                    (row) => String(row.status || "").toLowerCase() === "late"
                  ).length
                }
                label="late"
              />
            </div>
          </div>

          {attendanceError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: "12px" }}>
              {attendanceError}
            </Alert>
          )}

          {attendanceLoading ? (
            <div className="emp-dialog-loading">
              <CircularProgress />
            </div>
          ) : attendanceRows.length === 0 ? (
            <div className="emp-attendance-empty">
              No attendance records found in this date range.
            </div>
          ) : (
            <div className="admin-table-card emp-attendance-table">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Check-in</TableCell>
                    <TableCell>Check-out</TableCell>
                    <TableCell>Working hours</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attendanceRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {formatAttendanceDate(row.attendanceDate)}
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "normal",
                          verticalAlign: "top",
                          minWidth: 170,
                        }}
                      >
                        <div className="emp-attendance-time">
                          <span>{formatAttendanceTime(row.checkInTime)}</span>
                          {row.isLate && (
                            <StatusBadge status="Pending" label="Late" />
                          )}
                        </div>
                        <AttendanceMapLink
                          latitude={row.checkInLatitude}
                          longitude={row.checkInLongitude}
                          accuracy={row.checkInAccuracy}
                          distanceMeters={row.checkInDistanceMeters}
                          locationName={row.checkInLocationName}
                          label="Open check-in location"
                          showDetails
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "normal",
                          verticalAlign: "top",
                          minWidth: 170,
                        }}
                      >
                        <div className="emp-attendance-time">
                          <span>{formatAttendanceTime(row.checkOutTime)}</span>
                        </div>
                        <AttendanceMapLink
                          latitude={row.checkOutLatitude}
                          longitude={row.checkOutLongitude}
                          accuracy={row.checkOutAccuracy}
                          distanceMeters={row.checkOutDistanceMeters}
                          locationName={row.checkOutLocationName}
                          label="Open check-out location"
                          showDetails
                        />
                      </TableCell>
                      <TableCell
                        sx={{ whiteSpace: "nowrap", fontWeight: 600 }}
                      >
                        {attendanceHours(row)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          {...attendanceStatusMap(row.status)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            bgcolor: "#ffffff",
            borderTop: "1px solid #eef0f6",
          }}
        >
          <button
            type="button"
            className="admin-btn is-ghost-dark"
            onClick={() => setAttendanceOpen(false)}
          >
            Close
          </button>
        </DialogActions>
      </Dialog>

      <ConfirmModal
        open={docConfirm.open}
        title="Delete document"
        message="Ye wapas nahi hoga."
        loading={Boolean(docDeleting)}
        onConfirm={confirmDeleteDoc}
        onClose={() => {
          if (!docDeleting) setDocConfirm({ open: false, docType: null });
        }}
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

export default EmployeeDirectory;
