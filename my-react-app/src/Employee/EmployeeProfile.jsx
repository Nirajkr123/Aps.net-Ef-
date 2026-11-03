import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card, CardContent, Typography, Box, TextField, Button,
  CircularProgress, Alert, Snackbar, Chip,
  LinearProgress, FormControl, InputLabel, Select, MenuItem,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  useMediaQuery,
} from "@mui/material";
import {
  PersonOutlined, EmailOutlined, BadgeOutlined, PhoneOutlined,
  HomeOutlined, EmergencyOutlined, CheckCircle,
  Save, EditOutlined, BusinessOutlined, WorkOutlineOutlined,
  SchoolOutlined, UploadFile, Delete, Male, Female, CalendarMonth,
  FamilyRestroom, Close, Visibility, InfoOutlined,
  AccessTimeOutlined, EventOutlined, PaymentsOutlined,
  ArrowBack,
} from "@mui/icons-material";

import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";
import "./EmployeeProfile.css";

import StatCard from "./components/dashboard/StatCard";
import BottomNav from "./components/dashboard/BottomNav";
import ProfileHeader from "./components/profile/ProfileHeader";
import ManagerCard from "./components/profile/ManagerCard";
import WorkingHoursCard from "./components/profile/WorkingHoursCard";
import ProfileMenuList from "./components/profile/ProfileMenuList";
import employeeServ from "../services/employeeService";
import educationServ from "../services/educationService";
import documentServ from "../services/documentService";
import dashboardServ from "../services/dashboardService";
import http from "../services/http";

const EMPLOYEE_NAV_ITEMS = [
  { key: "my-dashboard", label: "My Dashboard", icon: PersonOutlined },
  { key: "my-profile", label: "My Profile", icon: BadgeOutlined },
  { key: "my-attendance", label: "My Attendance", icon: AccessTimeOutlined },
  { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
  { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

const EDUCATION_LEVELS = [
  { value: "10th", label: "10th (SSC)" },
  { value: "12th", label: "12th (HSC)" },
  { value: "UG", label: "Undergraduate" },
];

/* Document slots — stepper ka "Documents" count aur step 2 ki cards
   dono isi list se aate hain, taaki dono hamesha sync rahein. */
const DOCUMENT_TYPES = [
  { type: "marksheet_10", label: "10th Marksheet", icon: <SchoolOutlined /> },
  { type: "marksheet_12", label: "12th Marksheet", icon: <SchoolOutlined /> },
  { type: "marksheet_ug", label: "UG Degree / Marksheet", icon: <SchoolOutlined /> },
  { type: "govt_id", label: "Government ID (Aadhaar/PAN/Passport)", icon: <BadgeOutlined /> },
];

/* Self-editable personal fields. Har field par click karne par
   popup khulta hai. `key` wahi hai jo `form` state aur
   PUT /api/Employee/me/update dono use karte hain. */
const PERSONAL_FIELDS = [
  { key: "fatherName", label: "Father's Name", type: "text", required: true, placeholder: "e.g. Ramesh Sharma", icon: <FamilyRestroom /> },
  { key: "motherName", label: "Mother's Name", type: "text", required: true, placeholder: "e.g. Sunita Sharma", icon: <FamilyRestroom /> },
  { key: "gender", label: "Gender", type: "select", required: true, options: ["Male", "Female", "Other"], icon: <Male /> },
  { key: "dob", label: "Date of Birth", type: "date", required: true, icon: <CalendarMonth /> },
  { key: "phone", label: "Phone Number", type: "tel", required: true, placeholder: "e.g. +91 9876543210", icon: <PhoneOutlined /> },
  { key: "emergencyContact", label: "Emergency Contact", type: "text", required: true, placeholder: "e.g. Ramesh - +91 9876543211", icon: <EmergencyOutlined /> },
  { key: "address", label: "Address", type: "multiline", required: true, placeholder: "e.g. 123 MG Road, Mumbai", icon: <HomeOutlined /> },
];

/* Gender ka read-only display alag icon deta hai */
function fieldDisplayIcon(key, currentValue) {
  if (key === "gender") return currentValue === "Female" ? <Female /> : <Male />;
  return PERSONAL_FIELDS.find((f) => f.key === key)?.icon;
}

/* Full screen hote waqt MUI ke default `margin: 20px` ko apne
   sx se force karna padta hai, warna paper beech me hi chhota
   reh jaata hai. `slotProps` naya API hai, `PaperProps` purana —
   dono de rahe hain taaki MUI version ke hisaab se chal sake. */
const paperSx = (isNarrow) =>
  isNarrow
    ? { borderRadius: 0, m: 0, height: "100%", maxHeight: "100%", width: "100%" }
    : { borderRadius: 3, m: 3 };

function EmployeeProfile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  /* Mobile/tablet par popup poori screen leleti hai. 900px rakha hai
     kyunki portrait tablet aur DevTools preview par bhi centered box
     bahut chhota lagta hai. */
  const isNarrow = useMediaQuery("(max-width:900px)");
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [success, setSuccess] = useState(false);
  const [educationList, setEducationList] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploading, setUploading] = useState({});
  const [viewDoc, setViewDoc] = useState(null);
  const [docBlobUrl, setDocBlobUrl] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [hoursThisWeek, setHoursThisWeek] = useState(0);

  const emptyForm = {
    phone: "", address: "", emergencyContact: "",
    fatherName: "", motherName: "", gender: "", dob: "",
  };
  const [form, setForm] = useState(emptyForm);

  /* Popup editor state */
  /* "Edit" button wala bulk popup — alag draft rakhte hain
     taaki Cancel karne se typing lose na ho */
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDraft, setBulkDraft] = useState(emptyForm);
  const [bulkErrors, setBulkErrors] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);

  /* Inline edit + auto-save (real-time) */
  const [inlineEdit, setInlineEdit] = useState(null);
  const [inlineValue, setInlineValue] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

  /* Academic popup state — null = band, object = open modal */
  const [eduModal, setEduModal] = useState(null);

  const [eduForms, setEduForms] = useState({
    "10th": { institution: "", board: "", yearOfPassing: "", percentage: "", cgpa: "" },
    "12th": { institution: "", board: "", yearOfPassing: "", percentage: "", cgpa: "" },
    "UG": { institution: "", board: "", yearOfPassing: "", percentage: "", cgpa: "" },
  });
  const [eduErrors, setEduErrors] = useState({});

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      setUser(stored);
    } catch { setUser(null); }
    fetchAll();
  }, []);

  useEffect(() => {
    if (!viewDoc || !employee?.id) {
      setDocBlobUrl(null);
      return;
    }
    let cancelled = false;
    let blobUrl = null;
    const fetchDoc = async () => {
      setDocLoading(true);
      try {
        const res = await http.get("/api/Document/view-by-employee", {
          params: { employeeId: employee.id, documentType: viewDoc.documentType },
          responseType: "blob",
        });
        if (!cancelled) {
          const blob = new Blob([res.data], { type: res.headers["content-type"] });
          blobUrl = URL.createObjectURL(blob);
          setDocBlobUrl(blobUrl);
        }
      } catch (e) {
        console.error("Failed to load document:", e);
      }
      if (!cancelled) setDocLoading(false);
    };
    fetchDoc();
    return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [viewDoc, employee?.id]);

  const fetchAll = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [profileRes, eduRes, docRes] = await Promise.all([
        employeeServ.getMe(),
        educationServ.getMy(),
        documentServ.getMy(),
      ]);
      const profileData = profileRes.data;
      setEmployee(profileData);
      setProfilePhotoUrl(profileData.profilePhotoUrl || null);
      const newForm = {
        phone: profileData.phone || "",
        address: profileData.address || "",
        emergencyContact: profileData.emergencyContact || "",
        fatherName: profileData.fatherName || "",
        motherName: profileData.motherName || "",
        gender: profileData.gender || "",
        dob: profileData.dob ? profileData.dob.split("T")[0] : "",
      };
      setForm(newForm);
      const eduData = eduRes.data;
      setEducationList(eduData);
      const updated = { ...eduForms };
      eduData.forEach((e) => {
        if (updated[e.level]) {
          updated[e.level] = {
            institution: e.institution || "",
            board: e.board || "",
            yearOfPassing: e.yearOfPassing || "",
            percentage: e.percentage || "",
            cgpa: e.cgpa || "",
          };
        }
      });
      setEduForms(updated);
      setDocuments(docRes.data);

      try {
        const { data: summaryData } = await dashboardServ.getSummary();
        setSummary(summaryData);
        setWeeklyHours(summaryData?.weeklyHours || []);
        setHoursThisWeek(summaryData?.hoursThisWeek || 0);
      } catch {
        setSummary(null);
        setWeeklyHours([]);
        setHoursThisWeek(0);
      }
    } catch (e) {
      console.error(e);
      setApiError("Failed to load profile data. Please try again.");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  /* ---------------- Personal fields validation ---------------- */

  const validateField = (key, value) => {
    const v = (value || "").trim();
    if (key === "phone") {
      if (!v) return "Phone number is required";
      if (!/^[0-9+\-\s()]{7,15}$/.test(v)) return "Enter a valid phone number (7-15 digits)";
      return "";
    }
    if (key === "dob") {
      if (!v) return "Date of birth is required";
      const picked = new Date(v);
      if (isNaN(picked.getTime())) return "Enter a valid date";
      if (picked > new Date()) return "Date of birth cannot be in the future";
      const age = (Date.now() - picked.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 15) return "Employee must be at least 15 years old";
      if (age > 75) return "Please check the year — age looks incorrect";
      return "";
    }
    if (key === "emergencyContact") {
      if (!v) return "Emergency contact is required";
      if (v.length < 3) return "Enter a name and a phone number";
      return "";
    }
    if (key === "fatherName" || key === "motherName") {
      if (!v) return "This field is required";
      if (v.length < 2) return "Must be at least 2 characters";
      if (v.length > 100) return "Must be under 100 characters";
      if (!/^[A-Za-z\s.]+$/.test(v)) return "Only letters, spaces and dots allowed";
      return "";
    }
    if (key === "gender") {
      if (!v) return "Gender is required";
      if (!["Male", "Female", "Other"].includes(v)) return "Select a valid option";
      return "";
    }
    if (key === "address") {
      if (!v) return "Address is required";
      if (v.length < 10) return "Enter a complete address (min 10 chars)";
      if (v.length > 500) return "Must be under 500 characters";
      return "";
    }
    if (!v) return "This field is required";
    if (v.length > 200) return "Must be under 200 characters";
    return "";
  };

  /* ---------------- "Edit" button: all fields in one popup ---------------- */

  const openBulkEditor = () => {
    setBulkDraft({ ...form });
    setBulkErrors({});
    setBulkOpen(true);
  };

  const closeBulkEditor = () => {
    setBulkOpen(false);
    setBulkErrors({});
  };

  const setBulkField = (key, value) => {
    setBulkDraft((prev) => ({ ...prev, [key]: value }));
    if (bulkErrors[key]) {
      setBulkErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
    }
  };

  const validateBulk = () => {
    const errs = {};
    PERSONAL_FIELDS.forEach((f) => {
      const msg = validateField(f.key, bulkDraft[f.key] || "");
      if (msg) errs[f.key] = msg;
    });
    setBulkErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveBulk = async () => {
    if (!validateBulk()) {
      /* pehla galat field scroll karke laao */
      const firstKey = Object.keys(bulkErrors)[0];
      document.getElementById(`bulk-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBulkSaving(true);
    try {
      const payload = Object.fromEntries(
        PERSONAL_FIELDS.map((f) => [f.key, (bulkDraft[f.key] || "").trim()])
      );
      await employeeServ.updateMe(payload);
      setForm(payload);
      setBulkOpen(false);
      setSuccess(true);
      fetchAll();
    } catch (e) {
      console.error(e);
    }
    setBulkSaving(false);
  };

  const handleSaveEducation = async (level) => {
    const data = eduForms[level];
    const newErrors = {};

    if (!data.institution.trim()) newErrors.institution = "Institution is required";
    if (!data.board.trim()) newErrors.board = "Board/University is required";
    if (!data.yearOfPassing) newErrors.yearOfPassing = "Year of Passing is required";
    if (data.cgpa && (isNaN(parseFloat(data.cgpa)) || parseFloat(data.cgpa) < 0 || parseFloat(data.cgpa) > 10)) {
      newErrors.cgpa = "CGPA must be between 0 and 10";
    }
    if (data.percentage && (isNaN(parseFloat(data.percentage)) || parseFloat(data.percentage) < 0 || parseFloat(data.percentage) > 100)) {
      newErrors.percentage = "Percentage must be between 0 and 100";
    }

    setEduErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const existing = educationList.find((e) => e.level === level);
      const body = {
        employeeId: employee.id,
        level,
        institution: data.institution,
        board: data.board,
        yearOfPassing: data.yearOfPassing ? parseInt(data.yearOfPassing) : null,
        percentage: data.percentage ? parseFloat(data.percentage) : null,
        cgpa: data.cgpa ? parseFloat(data.cgpa) : null,
      };
      if (existing) {
        await educationServ.update(existing.id, body);
      } else {
        await educationServ.create(body);
      }
      setEduModal(null);
      setEduErrors({});
      setSuccess(true);
      fetchAll();
    } catch (e) { console.error(e); }
  };

  const handleFileSelect = (docType, file) => {
    setSelectedFiles(prev => ({ ...prev, [docType]: file }));
  };

  const handleUploadDocument = async (docType) => {
    const file = selectedFiles[docType];
    if (!file) return;
    setUploading(prev => ({ ...prev, [docType]: true }));
    try {
      const { data: result } = await documentServ.upload(docType, employee.id, file);
      const docBody = {
        employeeId: employee.id,
        documentType: docType,
        documentName: file.name,
        documentUrl: result.fileName || file.name,
      };
      await documentServ.create(docBody);
      setSelectedFiles(prev => { const n = { ...prev }; delete n[docType]; return n; });
      setSuccess(true);
      fetchAll();
    } catch (e) { console.error(e); }
    setUploading(prev => { const n = { ...prev }; delete n[docType]; return n; });
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Delete this document?")) return;
    const doc = documents.find(d => d.id === docId);
    if (doc && employee?.id) {
      await documentServ.removeByType(employee.id, doc.documentType);
    } else {
      await documentServ.remove(docId);
    }
    fetchAll();
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const { data } = await employeeServ.uploadPhoto(file);
      setProfilePhotoUrl(data.profilePhotoUrl);
      setSuccess(true);
      fetchAll();
    } catch (err) {
      console.error("Photo upload failed:", err);
    }
    setPhotoUploading(false);
  };

  /* Inline edit handlers */
  const startInlineEdit = (field) => {
    setInlineEdit(field.key);
    setInlineValue(form[field.key] || "");
    setInlineError("");
  };

  const cancelInlineEdit = () => {
    setInlineEdit(null);
    setInlineValue("");
    setInlineError("");
  };

  const saveInlineField = async (fieldKey) => {
    const msg = validateField(fieldKey, inlineValue);
    setInlineError(msg);
    if (msg) return;
    setInlineSaving(true);
    try {
      const payload = { ...form, [fieldKey]: (inlineValue || "").trim() };
      await employeeServ.updateMe({ [fieldKey]: (inlineValue || "").trim() });
      setForm(payload);
      setSuccess(true);
      setInlineEdit(null);
      setInlineValue("");
      setInlineError("");
      fetchAll();
    } catch (e) {
      console.error(e);
    }
    setInlineSaving(false);
  };

  const displayName = employee
    ? [employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.email || "Employee"
    : user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee"
      : "Employee";

  const isProfileComplete = employee?.profileComplete;
  const filledFields = PERSONAL_FIELDS.filter((f) => form[f.key]).length;
  const completionPercent = Math.round((filledFields / PERSONAL_FIELDS.length) * 100);
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const role = user?.role || summary?.role || "EMPLOYEE";
  const detailView = view === "personal" || view === "documents" ? view : null;
  const availableWidgets = Array.isArray(summary?.widgets) && summary.widgets.length
    ? summary.widgets.filter((widget) => widget === "stats" || widget === "weeklyHours")
    : [];
  const widgetList = availableWidgets.length ? availableWidgets : ["stats", "weeklyHours"];
  const openView = (nextView) => setSearchParams({ view: nextView });
  const closeView = () => setSearchParams({}, { replace: true });

  return (
    <div className="dash-page emp-page">
      <Sidebar activeKey="my-profile" onLogout={handleLogout} title="HRMS" user={user} navItems={EMPLOYEE_NAV_ITEMS} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
        <Navbar userName={displayName} userRole={role} user={user} onLogout={handleLogout} collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
        <div className="dash-content emp-profile-content">
          {apiError && employee && (
            <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>{apiError}</Alert>
          )}

          {apiError && !employee && !loading ? (
            <div className="emp-home-error">
              <span>{apiError}</span>
              <Button variant="contained" onClick={fetchAll}>Retry</Button>
            </div>
          ) : (
            <>
              {!detailView && (
                <div className="emp-profile-overview">
                  <ProfileHeader
                    loading={loading}
                    displayName={displayName}
                    initials={initials}
                    profilePhotoUrl={profilePhotoUrl}
                    photoUploading={photoUploading}
                    onPhotoSelect={handlePhotoUpload}
                    role={role}
                    status={summary?.status}
                    onBack={() => navigate("/my-dashboard")}
                    onEdit={() => navigate("/profile/personal-info")}
                  />

                  {widgetList.map((widget) => {
                    if (widget === "stats") {
                      return (
                        <React.Fragment key="stats">
                          <div className="emp-profile-stats">
                            <StatCard
                              value={summary?.leave?.remaining ?? 0}
                              label="Leave days left"
                              tone="amber"
                              loading={loading}
                            />
                            <StatCard
                              value={summary?.presentThisMonth ?? 0}
                              label="Present this month"
                              tone="blue"
                              loading={loading}
                            />
                            <StatCard
                              value={`${Number(summary?.hoursThisWeek || 0).toFixed(1)}h`}
                              label="Hours this week"
                              tone="purple"
                              loading={loading}
                            />
                          </div>
                          <ManagerCard name={employee?.managerName} phone={employee?.managerPhone} />
                        </React.Fragment>
                      );
                    }

                    if (widget === "weeklyHours") {
                      return (
                        <WorkingHoursCard
                          key="weeklyHours"
                          days={weeklyHours}
                          total={hoursThisWeek}
                          loading={loading}
                        />
                      );
                    }

                    return null;
                  })}

                  <ProfileMenuList
                    role={role}
                    teamCount={summary?.teamCount}
                    onPersonal={() => navigate("/profile/personal-info")}
                    onDocuments={() => openView("documents")}
                    onLogout={handleLogout}
                  />
                </div>
              )}

              {detailView && (
                <div className="emp-profile-detail">
                  <div className="emp-profile-detail-head">
                    <button
                      type="button"
                      className="emp-profile-detail-back"
                      onClick={closeView}
                      aria-label="Back to profile"
                    >
                      <ArrowBack />
                    </button>
                    <div>
                      <h1>{detailView === "personal" ? "Personal info" : "Documents"}</h1>
                      <p>
                        {detailView === "personal"
                          ? "Contact, address and academic details"
                          : "Marksheets and government ID"}
                      </p>
                    </div>
                  </div>

                  {loading ? (
                    <div className="emp-profile-detail-loading">
                      <CircularProgress />
                    </div>
                  ) : (
                    <div className="emp-profile-detail-stack">
          {/* Step 0: Personal Details */}
          {detailView === "personal" && (
            <div className="emp-prof-split">
              <div>
                <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", height: "100%" }}>
                  <CardContent sx={{ p: 2.25 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.75 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1, fontSize: 18 }}>
                        <BadgeOutlined sx={{ color: "#4f46e5", fontSize: 20 }} /> Account Info
                      </Typography>
                      <Chip label="Read-only" size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    </Box>
                    <div className="emp-prof-info-grid">
                      {[
                        { icon: <PersonOutlined />, label: "Full Name", value: displayName },
                        { icon: <EmailOutlined />, label: "Email", value: employee?.email || user?.email },
                        { icon: <BadgeOutlined />, label: "Role", value: role },
                        { icon: <BadgeOutlined />, label: "Employee Code", value: employee?.employeeCode || "—" },
                        { icon: <BusinessOutlined />, label: "Department", value: employee?.departmentName || "—" },
                        { icon: <WorkOutlineOutlined />, label: "Designation", value: employee?.designationTitle || "—" },
                        { icon: <WorkOutlineOutlined />, label: "Employment Type", value: employee?.employmentType?.replace("_", " ") || "—" },
                        { icon: <CalendarMonth />, label: "Joining Date", value: employee?.joiningDate ? new Date(employee.joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
                        { icon: <PersonOutlined />, label: "Manager", value: employee?.managerName || "—" },
                      ].map((item) => (
                        <Box key={item.label} className="emp-prof-dense-row">
                          <Box className="emp-prof-dense-icon" sx={{ width: 28, height: 28, borderRadius: 1.25, bgcolor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {React.cloneElement(item.icon, { sx: { fontSize: 16, color: "#6b7280" } })}
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 500, textTransform: "uppercase", fontSize: 11 }}>{item.label}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#171b2e", overflowWrap: "anywhere" }}>{item.value}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card id="emp-personal-details" sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", height: "100%" }}>
                  <CardContent sx={{ p: 2.25 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1, flexWrap: "wrap" }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1, fontSize: 18 }}>
                          <EditOutlined sx={{ color: "#4f46e5", fontSize: 20 }} /> Personal Details
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                          {filledFields}/{PERSONAL_FIELDS.length} filled
                        </Typography>
                      </Box>
                      <Button variant="contained" size="small" startIcon={<EditOutlined />}
                        onClick={openBulkEditor}
                        sx={{ textTransform: "none", backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, flexShrink: 0 }}>
                        Edit
                      </Button>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {PERSONAL_FIELDS.map((field, idx, arr) => {
                        const raw = form[field.key];
                        const filled = !!raw;
                        const display = field.key === "dob" && raw
                          ? new Date(raw).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : raw;
                        const isEditing = inlineEdit === field.key;
                        return (
                          <Box
                            key={field.key}
                            className={`emp-prof-dense-row${filled ? "" : " is-empty"}`}
                            sx={{
                              display: "flex", alignItems: "flex-start", gap: 1.5, py: 0.9, px: 1,
                              borderBottom: idx < arr.length - 1 ? "1px solid #f3f4f6" : "none",
                              borderRadius: 1.5,
                              transition: "background 0.2s",
                              "&:hover": { bgcolor: "#f9fafb" },
                            }}
                          >
                            <Box className="emp-prof-dense-icon" sx={{
                              width: 32, height: 32, borderRadius: 1.5,
                              bgcolor: filled ? "#ede9fe" : "#fee2e2",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0,
                              mt: 0.2,
                            }}>
                              {React.cloneElement(fieldDisplayIcon(field.key, raw), { sx: { fontSize: 18, color: filled ? "#7c3aed" : "#dc2626" } })}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                                <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 500, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>
                                  {field.label}{field.required && " *"}
                                </Typography>
                                {!isEditing && (
                                  <Tooltip title="Edit inline">
                                    <IconButton size="small" onClick={() => startInlineEdit(field)} sx={{ p: 0.25 }}>
                                      <EditOutlined sx={{ fontSize: 16, color: "#6b7280" }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                              {isEditing ? (
                                <Box sx={{ mt: 0.5 }}>
                                  {field.type === "select" ? (
                                    <FormControl size="small" fullWidth error={!!inlineError}>
                                      <Select
                                        value={inlineValue}
                                        onChange={(e) => { setInlineValue(e.target.value); setInlineError(validateField(field.key, e.target.value)); }}
                                        onBlur={() => setInlineError(validateField(field.key, inlineValue))}
                                        displayEmpty
                                      >
                                        <MenuItem value="" disabled>Select {field.label}</MenuItem>
                                        {field.options?.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                                      </Select>
                                      {inlineError && <Typography variant="caption" color="error">{inlineError}</Typography>}
                                    </FormControl>
                                  ) : (
                                    <TextField
                                      size="small"
                                      fullWidth
                                      type={field.type || "text"}
                                      value={inlineValue}
                                      onChange={(e) => { setInlineValue(e.target.value); setInlineError(validateField(field.key, e.target.value)); }}
                                      onBlur={() => setInlineError(validateField(field.key, inlineValue))}
                                      error={!!inlineError}
                                      helperText={inlineError || " "}
                                      multiline={field.type === "multiline"}
                                      rows={field.type === "multiline" ? 2 : 1}
                                      InputLabelProps={field.type === "date" ? { shrink: true } : undefined}
                                      inputProps={field.type === "tel" ? { inputMode: "tel" } : undefined}
                                    />
                                  )}
                                  <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                                    <Button size="small" variant="contained" disabled={inlineSaving}
                                      onClick={() => saveInlineField(field.key)}
                                      sx={{ textTransform: "none", bgcolor: "#4f46e5" }}>
                                      {inlineSaving ? <CircularProgress size={14} color="inherit" /> : "Save"}
                                    </Button>
                                    <Button size="small" onClick={cancelInlineEdit} disabled={inlineSaving} sx={{ textTransform: "none" }}>
                                      Cancel
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <Typography variant="body2" sx={{
                                  fontWeight: 600, color: filled ? "#171b2e" : "#dc2626",
                                  fontStyle: filled ? "normal" : "italic",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {display || "Not provided"}
                                </Typography>
                              )}
                            </Box>
                            {!isEditing && filled && <CheckCircle sx={{ color: "#10b981", fontSize: 18, flexShrink: 0, mt: 0.2 }} />}
                          </Box>
                        );
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 1: Academic Details */}
          {detailView === "personal" && (
            <>
              {/* Profile Completion bar — banner se yahan shift kiya gaya hai */}
              <Card sx={{ mb: 2, borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1, flexWrap: "wrap" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#171b2e", minWidth: 0 }}>
                      Profile Completion
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, flexShrink: 0, color: isProfileComplete ? "#059669" : "#d97706" }}>
                      {completionPercent}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={completionPercent}
                    sx={{
                      height: 8, borderRadius: 4, bgcolor: "#f3f4f6",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 4,
                        background: isProfileComplete
                          ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                          : "linear-gradient(90deg, #fbbf24 0%, #d97706 100%)",
                      },
                    }}
                  />
                  {/* component="p" zaroori hai — MUI ka "caption" default me
                      inline <span> render hota hai, jo text ko wrap nahi karne deta */}
                  <Typography variant="caption" component="p" sx={{ color: "#9ca3af", mt: 1, lineHeight: 1.5 }}>
                    {filledFields} of {PERSONAL_FIELDS.length} personal details filled
                    {isProfileComplete ? " — your profile is complete." : ` — ${PERSONAL_FIELDS.length - filledFields} more to complete.`}
                  </Typography>
                  {!isProfileComplete && (
                    <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
                      {PERSONAL_FIELDS.filter((f) => !form[f.key]).map((f) => (
                        <Chip
                          key={f.key}
                          label={f.label}
                          size="small"
                          variant="outlined"
                          onClick={() => document.getElementById("emp-personal-details")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                          title={`Fill ${f.label}`}
                          sx={{
                            height: 22,
                            fontSize: 11,
                            fontWeight: 600,
                            borderColor: "#fecaca",
                            color: "#dc2626",
                            backgroundColor: "#fef2f2",
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>

              <div className="emp-prof-grid-3">
              {EDUCATION_LEVELS.map(({ value, label }) => {
                const saved = educationList.find((e) => e.level === value);
                return (
                  <div key={value}>
                    <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", height: "100%" }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box className="emp-prof-card-head" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                          <SchoolOutlined sx={{ color: "#4f46e5" }} />
                          <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", minWidth: 0 }}>{label}</Typography>
                          {saved ? <Chip label="Saved" size="small" color="success" variant="outlined" sx={{ ml: "auto" }} />
                            : <Chip label="Not added" size="small" color="default" variant="outlined" sx={{ ml: "auto" }} />}
                        </Box>

                        {/* Card sirf summary dikhata hai — niche diye button se popup khulta hai */}
                        <Box>
                          {saved ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                              {[
                                { label: "Institution", value: saved.institution },
                                { label: "Board/University", value: saved.board },
                                { label: "Year of Passing", value: saved.yearOfPassing },
                                { label: "Percentage", value: saved.percentage ? `${saved.percentage}%` : null },
                                { label: "CGPA", value: saved.cgpa },
                              ].map((item, idx, arr) => (
                                <Box key={item.label} className="emp-prof-dense-row" sx={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  gap: 1, py: 1.2, px: 1, borderBottom: idx < arr.length - 1 ? "1px solid #f3f4f6" : "none",
                                }}>
                                  <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 500, textTransform: "uppercase", fontSize: 10 }}>{item.label}</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: item.value ? "#171b2e" : "#d1d5db", textAlign: "right", overflowWrap: "anywhere" }}>
                                    {item.value || "—"}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <Box sx={{ textAlign: "center", py: 2.5, color: "#9ca3af" }}>
                              <SchoolOutlined sx={{ fontSize: 30, mb: 0.5 }} />
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#6b7280" }}>{label} not added</Typography>
                              <Typography variant="caption">Institution, board, year &amp; marks</Typography>
                            </Box>
                          )}
                        </Box>

                        <Button variant={saved ? "outlined" : "contained"} size="small" fullWidth
                          startIcon={<EditOutlined />}
                          onClick={() => { setEduModal(value); setEduErrors({}); }}
                          sx={{
                            mt: 1.5, textTransform: "none", fontWeight: 600,
                            ...(saved
                              ? { borderColor: "#d1d5db", color: "#374151" }
                              : { backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" } }),
                          }}>
                          {saved ? `Edit ${label}` : `Add ${label}`}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
              </div>
            </>
          )}

          {/* Step 2: Documents */}
          {detailView === "documents" && (
            <div className="emp-prof-grid-2">
              {DOCUMENT_TYPES.map(({ type, label, icon }) => {
                const existing = documents.find((d) => d.documentType === type);
                return (
                  <div key={type}>
                    <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box className="emp-prof-card-head" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                          {React.cloneElement(icon, { sx: { color: "#4f46e5", flexShrink: 0 } })}
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#171b2e", minWidth: 0 }}>{label}</Typography>
                          {existing && <Chip label="Uploaded" size="small" color="success" variant="outlined" sx={{ ml: "auto" }} />}
                        </Box>
                        {existing ? (
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, bgcolor: "#f0fdf4", borderRadius: 2, border: "1px solid #bbf7d0", mb: 1.5 }}>
                              <Tooltip title={existing.documentName}>
                                <Typography variant="body2" sx={{ fontWeight: 500, color: "#166534", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {existing.documentName}
                                </Typography>
                              </Tooltip>
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <Tooltip title="View Document">
                                  <IconButton size="small" color="primary" onClick={() => setViewDoc(existing)}>
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <IconButton size="small" color="error" onClick={() => handleDeleteDocument(existing.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          </Box>
                        ) : selectedFiles[type] ? (
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, bgcolor: "#eff6ff", borderRadius: 2, border: "1px solid #bfdbfe", mb: 1.5 }}>
                              <UploadFile sx={{ color: "#3b82f6", fontSize: 20 }} />
                              <Typography variant="body2" sx={{ fontWeight: 500, color: "#1e40af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {selectedFiles[type].name}
                              </Typography>
                              <IconButton size="small" onClick={() => setSelectedFiles(prev => { const n = { ...prev }; delete n[type]; return n; })}>
                                <Close sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                            <Button variant="contained" size="small" fullWidth startIcon={uploading[type] ? <CircularProgress size={16} color="inherit" /> : <Save />}
                              onClick={() => handleUploadDocument(type)} disabled={uploading[type]}
                              sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
                              {uploading[type] ? "Uploading..." : "Upload Now"}
                            </Button>
                          </Box>
                        ) : (
                          <Box>
                            <Button variant="outlined" component="label" startIcon={<UploadFile />} fullWidth
                              sx={{ textTransform: "none", borderColor: "#d1d5db", color: "#374151", py: 1.5, borderStyle: "dashed" }}>
                              Select File
                              <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => e.target.files[0] && handleFileSelect(type, e.target.files[0])} />
                            </Button>
                            <Typography variant="caption" sx={{ color: "#9ca3af", mt: 0.5, display: "block" }}>PDF, JPG, PNG — Max 5MB</Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />

      <Snackbar open={success} autoHideDuration={4000} onClose={() => setSuccess(false)} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert onClose={() => setSuccess(false)} severity="success" sx={{ width: "100%", borderRadius: 2 }}>
          Saved successfully!
        </Alert>
      </Snackbar>

      {/* ============ Popup 0: "Edit" button — sabhi fields ek saath ============ */}
      <Dialog
        open={bulkOpen}
        onClose={bulkSaving ? undefined : closeBulkEditor}
        fullWidth
        maxWidth="sm"
        fullScreen={isNarrow}
        PaperProps={{ sx: paperSx(isNarrow) }} slotProps={{ paper: { sx: paperSx(isNarrow) } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1.2, pb: 1, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <EditOutlined sx={{ fontSize: 19, color: "#7c3aed" }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Edit Personal Details</Typography>
            <Typography variant="caption" sx={{ color: "#9ca3af" }}>
              {filledFields} of {PERSONAL_FIELDS.length} fields filled
            </Typography>
          </Box>
          <IconButton onClick={closeBulkEditor} disabled={bulkSaving} sx={{ ml: "auto", flexShrink: 0 }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: "12px !important" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="emp-prof-form-grid">
              {PERSONAL_FIELDS.filter((f) => f.type !== "multiline" && f.type !== "select").map((f) => (
                <div key={f.key} id={`bulk-${f.key}`}>
                  <TextField
                    label={`${f.label} *`}
                    placeholder={f.placeholder}
                    type={f.type || "text"}
                    size="small"
                    fullWidth
                    value={bulkDraft[f.key] || ""}
                    onChange={(e) => setBulkField(f.key, e.target.value)}
                    error={!!bulkErrors[f.key]}
                    helperText={bulkErrors[f.key] || " "}
                    InputLabelProps={f.type === "date" ? { shrink: true } : undefined}
                    inputProps={f.type === "tel" ? { inputMode: "tel" } : undefined}
                  />
                </div>
              ))}

              <div id="bulk-gender">
                <FormControl fullWidth size="small" error={!!bulkErrors.gender}>
                  <InputLabel>Gender *</InputLabel>
                  <Select label="Gender *" value={bulkDraft.gender || ""}
                    onChange={(e) => setBulkField("gender", e.target.value)}>
                    {PERSONAL_FIELDS.find((f) => f.key === "gender").options.map((o) => (
                      <MenuItem key={o} value={o}>{o}</MenuItem>
                    ))}
                  </Select>
                  {bulkErrors.gender
                    ? <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{bulkErrors.gender}</Typography>
                    : <Box sx={{ height: 20 }} />}
                </FormControl>
              </div>
            </div>

            <div id="bulk-address" style={{ marginTop: 8 }}>
              <TextField
                label="Address *"
                placeholder="e.g. 123 MG Road, Mumbai"
                size="small"
                fullWidth
                multiline
                rows={3}
                value={bulkDraft.address || ""}
                onChange={(e) => setBulkField("address", e.target.value)}
                error={!!bulkErrors.address}
                helperText={bulkErrors.address || " "}
              />
            </div>
          </Box>

          {Object.keys(bulkErrors).length > 0 && (
            <Alert severity="error" icon={<InfoOutlined fontSize="small" />} sx={{ mt: 2, borderRadius: 2, fontSize: 13 }}>
              {Object.keys(bulkErrors).length} field{Object.keys(bulkErrors).length > 1 ? "s" : ""} need attention before saving.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1, flexShrink: 0, borderTop: "1px solid #f3f4f6" }}>
          <Button onClick={closeBulkEditor} disabled={bulkSaving}
            sx={{ flex: 1, textTransform: "none", borderColor: "#d1d5db", color: "#374151" }}>
            Cancel
          </Button>
          <Button onClick={handleSaveBulk} disabled={bulkSaving} variant="contained"
            startIcon={bulkSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            sx={{ flex: 1.4, backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
            {bulkSaving ? "Saving..." : "Save Details"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============ Popup 2: academic level editor ============ */}
      <Dialog
        open={!!eduModal}
        onClose={() => setEduModal(null)}
        fullWidth
        maxWidth="sm"
        fullScreen={isNarrow}
        PaperProps={{ sx: paperSx(isNarrow) }} slotProps={{ paper: { sx: paperSx(isNarrow) } }}
      >
        {eduModal && (() => {
          const level = eduModal;
          const label = EDUCATION_LEVELS.find((e) => e.value === level)?.label;
          const isExisting = educationList.some((e) => e.level === level);
          const set = (k, v) => {
            setEduForms((prev) => ({ ...prev, [level]: { ...prev[level], [k]: v } }));
            if (eduErrors[k]) setEduErrors((p) => { const n = { ...p }; delete n[k]; return n; });
          };
          return (
            <>
              <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1.2, pb: 1 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <SchoolOutlined sx={{ fontSize: 19, color: "#7c3aed" }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{label}</Typography>
                  <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                    {isExisting ? `Update your ${label} record` : `Add your ${label} details`}
                  </Typography>
                </Box>
                <IconButton onClick={() => { setEduModal(null); setEduErrors({}); }} sx={{ ml: "auto", flexShrink: 0 }}>
                  <Close />
                </IconButton>
              </DialogTitle>

              <DialogContent sx={{ pt: "12px !important" }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField label="Institution *" placeholder="e.g. Delhi Public School" size="small"
                    value={eduForms[level].institution} onChange={(e) => set("institution", e.target.value)}
                    error={!!eduErrors.institution} helperText={eduErrors.institution} fullWidth />
                  <TextField label="Board/University *" placeholder="e.g. CBSE / Mumbai University" size="small"
                    value={eduForms[level].board} onChange={(e) => set("board", e.target.value)}
                    error={!!eduErrors.board} helperText={eduErrors.board} fullWidth />
                  <div className="emp-prof-form-grid">
                    <div>
                      <TextField label="Year of Passing *" placeholder="e.g. 2020" size="small" type="number"
                        value={eduForms[level].yearOfPassing} onChange={(e) => set("yearOfPassing", e.target.value)}
                        error={!!eduErrors.yearOfPassing} helperText={eduErrors.yearOfPassing} fullWidth />
                    </div>
                    <div>
                      <TextField label="Percentage %" placeholder="e.g. 85.5" size="small" type="number"
                        value={eduForms[level].percentage} onChange={(e) => set("percentage", e.target.value)}
                        error={!!eduErrors.percentage} helperText={eduErrors.percentage} fullWidth />
                    </div>
                    <div>
                      <TextField label="CGPA (out of 10)" placeholder="e.g. 8.5" size="small" type="number"
                        value={eduForms[level].cgpa} onChange={(e) => set("cgpa", e.target.value)}
                        error={!!eduErrors.cgpa} helperText={eduErrors.cgpa || "Optional"} fullWidth />
                    </div>
                  </div>
                </Box>
              </DialogContent>

              <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                <Button onClick={() => { setEduModal(null); setEduErrors({}); }}
                  sx={{ flex: 1, textTransform: "none", borderColor: "#d1d5db", color: "#374151" }}>Cancel</Button>
                <Button onClick={() => handleSaveEducation(level)} variant="contained"
                  startIcon={<Save />}
                  sx={{ flex: 1, backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
                  {isExisting ? "Update" : "Save"}
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={!!viewDoc} onClose={() => { setViewDoc(null); setDocBlobUrl(null); }} maxWidth="md" fullWidth
        fullScreen={isNarrow} PaperProps={{ sx: paperSx(isNarrow) }} slotProps={{ paper: { sx: paperSx(isNarrow) } }}>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Visibility sx={{ color: "#4f46e5", flexShrink: 0 }} />
          <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: { xs: 16, sm: 20 } }}>
            {viewDoc?.documentName}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, minHeight: { xs: 240, sm: 400 } }}>
          {docLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: { xs: 240, sm: 400 } }}>
              <CircularProgress />
            </Box>
          ) : docBlobUrl ? (
            viewDoc?.documentName?.toLowerCase().endsWith(".pdf") ? (
              <iframe src={docBlobUrl} width="100%" height="500px" style={{ border: "none", height: "60vh", maxHeight: 500 }} title={viewDoc.documentName} />
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                <img src={docBlobUrl} alt={viewDoc.documentName} style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: 8 }} />
              </Box>
            )
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: { xs: 240, sm: 400 }, color: "#9ca3af" }}>
              No document to display
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setViewDoc(null); setDocBlobUrl(null); }} sx={{ textTransform: "none" }}>Close</Button>
          {docBlobUrl && (
            <Button variant="contained" href={docBlobUrl} target="_blank" download={viewDoc?.documentName || "document"}
              sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}>
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default EmployeeProfile;
