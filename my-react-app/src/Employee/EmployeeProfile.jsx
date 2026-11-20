import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Snackbar,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    AccessTimeOutlined,
    ArrowBack,
    BadgeOutlined,
    Close,
    Delete,
    EventOutlined,
    FolderCopyOutlined,
    LockOutlined,
    LogoutOutlined,
    PaymentsOutlined,
    PeopleOutlined,
    PersonOutlined,
    Save,
    SchoolOutlined,
    UploadFile,
    Visibility,
} from "@mui/icons-material";

import { auth } from "../firebase";
import Sidebar from "../Admin/Sidebar";
import Navbar from "../Admin/Navbar";
import ProfileHeader from "./components/profile/ProfileHeader";
import ProfileBanner from "./components/profile/ProfileBanner";
import InfoCard from "./components/profile/InfoCard";
import InfoField from "./components/profile/InfoField";
import EditProfileForm from "./components/profile/EditProfileForm";
import ManagerCard from "./components/profile/ManagerCard";
import MoreList from "./components/profile/MoreList";
import WorkingHoursCard from "./components/profile/WorkingHoursCard";
import employeeServ from "../services/employeeService";
import documentServ from "../services/documentService";
import dashboardServ from "../services/dashboardService";
import http from "../services/http";
import useIsMobile from "../hooks/useIsMobile";

import "../Admin/AdminDashboard.css";
import "./EmployeeDashboard.css";
import "./EmployeeProfile.css";

const EMPLOYEE_NAV_ITEMS = [
    { key: "my-dashboard", label: "My Dashboard", icon: PersonOutlined },
    { key: "my-profile", label: "My Profile", icon: BadgeOutlined },
    { key: "my-attendance", label: "My Attendance", icon: AccessTimeOutlined },
    { key: "my-leaves", label: "My Leaves", icon: EventOutlined },
    { key: "my-payslips", label: "My Payslips", icon: PaymentsOutlined },
];

const DOCUMENT_TYPES = [
    { type: "marksheet_10", label: "10th Marksheet", icon: <SchoolOutlined /> },
    { type: "marksheet_12", label: "12th Marksheet", icon: <SchoolOutlined /> },
    { type: "marksheet_ug", label: "UG Degree / Marksheet", icon: <SchoolOutlined /> },
    { type: "govt_id", label: "Government ID (Aadhaar/PAN/Passport)", icon: <BadgeOutlined /> },
];

const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatShift = (employee) => {
    const name = employee?.shiftName?.trim();
    if (!name) return "Not assigned";
    const timing = employee?.shiftTiming?.trim();
    return timing ? `${name} (${timing})` : name;
};

const paperSx = (isNarrow) => (
    isNarrow
        ? { borderRadius: 0, m: 0, height: "100%", maxHeight: "100%", width: "100%" }
        : { borderRadius: 3, m: 3 }
);

function EmployeeProfile() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const view = searchParams.get("view");
    const isMobile = useIsMobile();
    const isNarrow = isMobile;

    const [user, setUser] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [summary, setSummary] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [collapsed, setCollapsed] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({ phone: "", address: "", emergencyContact: "" });
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

    const [selectedFiles, setSelectedFiles] = useState({});
    const [uploading, setUploading] = useState({});
    const [viewDoc, setViewDoc] = useState(null);
    const [docBlobUrl, setDocBlobUrl] = useState(null);
    const [docLoading, setDocLoading] = useState(false);

    const loadProfile = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        setError("");
        try {
            const { data } = await employeeServ.getMe();
            setEmployee(data);
            setForm({
                phone: data.phone || "",
                address: data.address || "",
                emergencyContact: data.emergencyContact || "",
            });

            try {
                const docRes = await documentServ.getMy();
                setDocuments(Array.isArray(docRes.data) ? docRes.data : []);
            } catch {
                setDocuments([]);
            }

            try {
                const { data: summaryData } = await dashboardServ.getSummary();
                setSummary(summaryData);
            } catch {
                setSummary(null);
            }
        } catch (e) {
            setEmployee(null);
            setError(e.response?.data?.message || "Profile data could not be loaded. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            setUser(stored);
        } catch {
            setUser(null);
        }
        loadProfile(true);
    }, [loadProfile]);

    useEffect(() => {
        if (!viewDoc || !employee?.id) {
            setDocBlobUrl(null);
            return undefined;
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
            } catch {
                if (!cancelled) setDocBlobUrl(null);
            }
            if (!cancelled) setDocLoading(false);
        };

        fetchDoc();

        return () => {
            cancelled = true;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [viewDoc, employee?.id]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch { }
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    const showToast = (severity, message) => {
        setToast({ open: true, severity, message });
    };

    const displayName = useMemo(() => {
        const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ");
        if (name) return name;
        if (user) return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Employee";
        return "Employee";
    }, [employee?.firstName, employee?.lastName, user]);

    const initials = useMemo(
        () => displayName.split(" ").filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2),
        [displayName]
    );

    const role = user?.role || summary?.role || "EMPLOYEE";
    const completedFields = [employee?.phone, employee?.address, employee?.emergencyContact]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
        .length;
    const isProfileComplete = Boolean(employee?.profileComplete) || completedFields === 3;

    const hoursThisWeek = Number(summary?.hoursThisWeek) || 0;
    const weeklyHours = summary?.weeklyHours || [];

    const detailView = view === "documents" ? "documents" : null;
    const openView = (nextView) => setSearchParams({ view: nextView });
    const closeView = () => setSearchParams({}, { replace: true });
    const openPersonalInfo = () => navigate("/profile/personal-info");

    const startEdit = () => {
        setForm({
            phone: employee?.phone || "",
            address: employee?.address || "",
            emergencyContact: employee?.emergencyContact || "",
        });
        setFormErrors({});
        setEditMode(true);
    };

    const cancelEdit = () => {
        setForm({
            phone: employee?.phone || "",
            address: employee?.address || "",
            emergencyContact: employee?.emergencyContact || "",
        });
        setFormErrors({});
        setEditMode(false);
    };

    const setField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        if (formErrors[field]) {
            setFormErrors((previous) => {
                const next = { ...previous };
                delete next[field];
                return next;
            });
        }
    };

    const validate = () => {
        const errors = {};
        if (!/^\d{10}$/.test(form.phone.trim())) {
            errors.phone = "Mobile number 10 digit ka hona chahiye";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveDetails = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            const payload = {
                phone: form.phone.trim(),
                address: form.address.trim(),
                emergencyContact: form.emergencyContact.trim(),
            };
            await employeeServ.updateMe(payload);
            setEmployee((previous) => (previous ? { ...previous, ...payload } : previous));
            setEditMode(false);
            setFormErrors({});
            showToast("success", "Details save ho gayi");
        } catch (e) {
            showToast("error", e.response?.data?.message || "Details save nahi ho paayi. Retry karein.");
        } finally {
            setSaving(false);
        }
    };

    const handleFileSelect = (docType, file) => {
        setSelectedFiles((previous) => ({ ...previous, [docType]: file }));
    };

    const handleUploadDocument = async (docType) => {
        const file = selectedFiles[docType];
        if (!file) return;

        setUploading((previous) => ({ ...previous, [docType]: true }));
        try {
            const { data: result } = await documentServ.upload(docType, employee.id, file);
            await documentServ.create({
                employeeId: employee.id,
                documentType: docType,
                documentName: file.name,
                documentUrl: result.fileName || file.name,
            });
            setSelectedFiles((previous) => {
                const next = { ...previous };
                delete next[docType];
                return next;
            });
            showToast("success", "Document uploaded");
            loadProfile(false);
        } catch (e) {
            showToast("error", e.response?.data?.message || "Document upload failed. Retry karein.");
        } finally {
            setUploading((previous) => {
                const next = { ...previous };
                delete next[docType];
                return next;
            });
        }
    };

    const handleDeleteDocument = async (docId) => {
        if (!window.confirm("Delete this document?")) return;
        const doc = documents.find((item) => item.id === docId);
        try {
            if (doc && employee?.id) {
                await documentServ.removeByType(employee.id, doc.documentType);
            } else {
                await documentServ.remove(docId);
            }
            loadProfile(false);
        } catch (e) {
            showToast("error", e.response?.data?.message || "Document delete failed. Retry karein.");
        }
    };

    const moreItems = [
        {
            key: "documents",
            label: "Documents",
            icon: <FolderCopyOutlined />,
            tone: "blue",
            onClick: () => openView("documents"),
        },
        {
            key: "payslips",
            label: "My Payslips",
            icon: <PaymentsOutlined />,
            onClick: () => navigate("/my-payslips"),
        },
        {
            key: "password",
            label: "Change password",
            icon: <LockOutlined />,
            onClick: () => navigate("/settings"),
        },
        ...(role === "MANAGER" && summary?.teamCount !== null && summary?.teamCount !== undefined
            ? [{
                key: "team",
                label: `Team (${summary.teamCount})`,
                icon: <PeopleOutlined />,
                tone: "green",
            }]
            : []),
        {
            key: "logout",
            label: "Logout",
            icon: <LogoutOutlined />,
            tone: "red",
            danger: true,
            onClick: handleLogout,
        },
    ];

    const mobileItems = [
        {
            key: "personal",
            label: "Personal info",
            icon: <PersonOutlined />,
            onClick: openPersonalInfo,
        },
        {
            key: "documents",
            label: "Documents",
            icon: <FolderCopyOutlined />,
            tone: "blue",
            onClick: () => openView("documents"),
        },
        {
            key: "payslips",
            label: "Payslips",
            icon: <PaymentsOutlined />,
            onClick: () => navigate("/my-payslips"),
        },
        {
            key: "logout",
            label: "Logout",
            icon: <LogoutOutlined />,
            tone: "red",
            danger: true,
            onClick: handleLogout,
        },
    ];

    const renderDocuments = () => (
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
                    <h1>Documents</h1>
                    <p>Marksheets and government ID</p>
                </div>
            </div>

            {loading ? (
                <div className="emp-profile-detail-loading">
                    <CircularProgress />
                </div>
            ) : (
                <div className="emp-prof-grid-2">
                    {DOCUMENT_TYPES.map(({ type, label, icon }) => {
                        const existing = documents.find((doc) => doc.documentType === type);
                        return (
                            <div key={type}>
                                <Card sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box className="emp-prof-card-head" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                                            {React.cloneElement(icon, { sx: { color: "#4f46e5", flexShrink: 0 } })}
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#171b2e", minWidth: 0 }}>
                                                {label}
                                            </Typography>
                                            {existing && (
                                                <Chip label="Uploaded" size="small" color="success" variant="outlined" sx={{ ml: "auto" }} />
                                            )}
                                        </Box>

                                        {existing ? (
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
                                        ) : selectedFiles[type] ? (
                                            <Box>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, bgcolor: "#eff6ff", borderRadius: 2, border: "1px solid #bfdbfe", mb: 1.5 }}>
                                                    <UploadFile sx={{ color: "#3b82f6", fontSize: 20 }} />
                                                    <Typography variant="body2" sx={{ fontWeight: 500, color: "#1e40af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {selectedFiles[type].name}
                                                    </Typography>
                                                    <IconButton size="small" onClick={() => setSelectedFiles((previous) => {
                                                        const next = { ...previous };
                                                        delete next[type];
                                                        return next;
                                                    })}>
                                                        <Close sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Box>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    fullWidth
                                                    startIcon={uploading[type] ? <CircularProgress size={16} color="inherit" /> : <Save />}
                                                    onClick={() => handleUploadDocument(type)}
                                                    disabled={uploading[type]}
                                                    sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}
                                                >
                                                    {uploading[type] ? "Uploading..." : "Upload Now"}
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Box>
                                                <Button
                                                    variant="outlined"
                                                    component="label"
                                                    startIcon={<UploadFile />}
                                                    fullWidth
                                                    sx={{ textTransform: "none", borderColor: "#d1d5db", color: "#374151", py: 1.5, borderStyle: "dashed" }}
                                                >
                                                    Select File
                                                    <input
                                                        type="file"
                                                        hidden
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={(event) => event.target.files[0] && handleFileSelect(type, event.target.files[0])}
                                                    />
                                                </Button>
                                                <Typography variant="caption" sx={{ color: "#9ca3af", mt: 0.5, display: "block" }}>
                                                    PDF, JPG, PNG — Max 5MB
                                                </Typography>
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
    );

    const personalFields = (
        <>
            <InfoField label="Full name" value={displayName} loading={loading} />
            <InfoField label="Employee ID" value={employee?.employeeCode} loading={loading} />
            <InfoField label="Date of birth" value={formatDate(employee?.dob)} loading={loading} />
            <InfoField label="Gender" value={employee?.gender} loading={loading} />
            <InfoField
                id="profile-mobile"
                label="Mobile"
                value={employee?.phone}
                loading={loading}
                editing={editMode}
                editable
                type="tel"
                inputValue={form.phone}
                onChange={(value) => setField("phone", value)}
                error={formErrors.phone}
            />
            <InfoField label="Email" value={employee?.email} loading={loading} />
            <InfoField
                id="profile-address"
                label="Address"
                value={employee?.address}
                loading={loading}
                editing={editMode}
                editable
                multiline
                inputValue={form.address}
                onChange={(value) => setField("address", value)}
                className="span-all"
            />
        </>
    );

    const workFields = (
        <>
            <InfoField label="Department" value={employee?.departmentName} loading={loading} />
            <InfoField label="Designation" value={employee?.designationTitle} loading={loading} />
            <InfoField label="Shift" value={formatShift(employee)} loading={loading} />
            <InfoField label="Date of joining" value={formatDate(employee?.joiningDate)} loading={loading} />
            <InfoField label="Location" value={employee?.location} loading={loading} />
        </>
    );

    const renderDesktop = () => (
        <div className="emp-prof-view">
            <ProfileBanner
                loading={loading}
                displayName={displayName}
                initials={initials}
                profilePhotoUrl={employee?.profilePhotoUrl}
                employeeCode={employee?.employeeCode}
                designationTitle={employee?.designationTitle}
                departmentName={employee?.departmentName}
                shiftLabel={employee?.shiftName ? formatShift(employee) : null}
                status={summary?.status}
                profileComplete={isProfileComplete}
                onEdit={startEdit}
            />

            <div className="emp-prof-columns">
                <div className="emp-prof-col-main">
                    {editMode ? (
                        <EditProfileForm saving={saving} onSave={saveDetails} onCancel={cancelEdit}>
                            <InfoCard title="Personal info">{personalFields}</InfoCard>
                            <InfoCard title="Work info">{workFields}</InfoCard>
                        </EditProfileForm>
                    ) : (
                        <>
                            <InfoCard
                                title="Personal info"
                                action={(
                                    <button type="button" className="emp-prof-card-link" onClick={startEdit}>
                                        Edit
                                    </button>
                                )}
                            >
                                {personalFields}
                            </InfoCard>
                            <InfoCard title="Work info">{workFields}</InfoCard>
                        </>
                    )}
                </div>

                <aside className="emp-prof-col-side">
                    <ManagerCard
                        name={employee?.managerName}
                        phone={employee?.managerPhone}
                        loading={loading}
                    />

                    <InfoCard title="Emergency contact" className="is-side">
                        <InfoField
                            id="profile-emergency-contact"
                            label="Emergency contact"
                            value={employee?.emergencyContact}
                            loading={loading}
                            editing={editMode}
                            editable
                            inputValue={form.emergencyContact}
                            onChange={(value) => setField("emergencyContact", value)}
                        />
                    </InfoCard>

                    <MoreList items={moreItems} label="More options" />
                </aside>
            </div>
        </div>
    );

    const renderMobile = () => (
        <div className="emp-profile-overview">
            <ProfileHeader
                loading={loading}
                displayName={displayName}
                initials={initials}
                profilePhotoUrl={employee?.profilePhotoUrl}
                role={role}
                shiftLabel={employee?.shiftName ? formatShift(employee) : null}
                status={summary?.status}
                onBack={() => navigate("/my-dashboard")}
                onEdit={openPersonalInfo}
            />

            <InfoCard title="Work info" className="emp-profile-work">
                <InfoField label="Department" value={employee?.departmentName} loading={loading} />
                <InfoField label="Designation" value={employee?.designationTitle} loading={loading} />
                <InfoField label="Shift" value={formatShift(employee)} loading={loading} />
            </InfoCard>

            <ManagerCard
                name={employee?.managerName}
                phone={employee?.managerPhone}
                loading={loading}
            />

            <WorkingHoursCard
                days={weeklyHours}
                total={hoursThisWeek}
                loading={loading}
            />

            <MoreList items={mobileItems} label="Profile options" />
        </div>
    );

    return (
        <div className="dash-page emp-page emp-profile-page">
            <Sidebar
                activeKey="my-profile"
                onLogout={handleLogout}
                title="HRMS"
                user={user}
                navItems={EMPLOYEE_NAV_ITEMS}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed(!collapsed)}
                profilePhotoUrl={employee?.profilePhotoUrl || null}
            />

            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={role}
                    user={user}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed(!collapsed)}
                    profilePhotoUrl={employee?.profilePhotoUrl || null}
                />

                <div className="dash-content emp-profile-content">
                    {error && employee && (
                        <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setError("")}>
                            {error}
                        </Alert>
                    )}

                    {error && !employee && !loading ? (
                        <div className="emp-home-error">
                            <span>{error}</span>
                            <Button variant="contained" onClick={() => loadProfile(true)}>Retry</Button>
                        </div>
                    ) : (
                        detailView === "documents"
                            ? renderDocuments()
                            : isMobile
                                ? renderMobile()
                                : renderDesktop()
                    )}
                </div>
            </div>

            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={() => setToast((previous) => ({ ...previous, open: false }))}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setToast((previous) => ({ ...previous, open: false }))}
                    severity={toast.severity}
                    sx={{ width: "100%", borderRadius: 2 }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>

            <Dialog
                open={!!viewDoc}
                onClose={() => {
                    setViewDoc(null);
                    setDocBlobUrl(null);
                }}
                maxWidth="md"
                fullWidth
                fullScreen={isNarrow}
                PaperProps={{ sx: paperSx(isNarrow) }}
                slotProps={{ paper: { sx: paperSx(isNarrow) } }}
            >
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
                            <iframe
                                src={docBlobUrl}
                                width="100%"
                                style={{ border: "none", height: "60vh", maxHeight: 500 }}
                                title={viewDoc.documentName}
                            />
                        ) : (
                            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                                <img
                                    src={docBlobUrl}
                                    alt={viewDoc.documentName}
                                    style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: 8 }}
                                />
                            </Box>
                        )
                    ) : (
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: { xs: 240, sm: 400 }, color: "#9ca3af" }}>
                            No document to display
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={() => {
                            setViewDoc(null);
                            setDocBlobUrl(null);
                        }}
                        sx={{ textTransform: "none" }}
                    >
                        Close
                    </Button>
                    {docBlobUrl && (
                        <Button
                            variant="contained"
                            href={docBlobUrl}
                            target="_blank"
                            download={viewDoc?.documentName || "document"}
                            sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" }, textTransform: "none" }}
                        >
                            Download
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default EmployeeProfile;
