import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Alert,
    Button,
    Snackbar,
} from "@mui/material";

import employeeServ from "../services/employeeService";
import PersonalInfoHeader from "./components/profile/personal-info/PersonalInfoHeader";
import InfoSection from "./components/profile/personal-info/InfoSection";
import InfoRow from "./components/profile/personal-info/InfoRow";
import EditActions from "./components/profile/personal-info/EditActions";
import "./EmployeePersonalInfo.css";

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

const valueOrDash = (value) => (
    value === null || value === undefined || String(value).trim() === "" ? "-" : value
);

function EmployeePersonalInfo() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        phone: "",
        address: "",
        emergencyContact: "",
    });
    const [formErrors, setFormErrors] = useState({});
    const [toast, setToast] = useState({
        open: false,
        severity: "success",
        message: "",
    });

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        try {
            const { data } = await employeeServ.getMe();
            setEmployee(data);
            setForm({
                phone: data.phone || "",
                address: data.address || "",
                emergencyContact: data.emergencyContact || "",
            });
        } catch (error) {
            setEmployee(null);
            setLoadError(
                error.response?.data?.message
                || "Personal info load nahi ho paayi. Please retry."
            );
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
        loadProfile();
    }, [loadProfile]);

    const fullName = useMemo(() => {
        const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ");
        return valueOrDash(name);
    }, [employee?.firstName, employee?.lastName]);

    const initials = useMemo(() => {
        if (fullName === "-") return "";
        return fullName
            .split(" ")
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    }, [fullName]);

    const role = user?.role || "-";

    const startEditing = () => {
        setForm({
            phone: employee?.phone || "",
            address: employee?.address || "",
            emergencyContact: employee?.emergencyContact || "",
        });
        setFormErrors({});
        setEditing(true);
    };

    const cancelEditing = () => {
        setForm({
            phone: employee?.phone || "",
            address: employee?.address || "",
            emergencyContact: employee?.emergencyContact || "",
        });
        setFormErrors({});
        setEditing(false);
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
        const phone = form.phone.trim();

        if (!/^\d{10}$/.test(phone)) {
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
            setEmployee((previous) => (
                previous
                    ? { ...previous, ...payload }
                    : previous
            ));
            setEditing(false);
            setFormErrors({});
            setToast({
                open: true,
                severity: "success",
                message: "Details save ho gayi",
            });
        } catch (error) {
            setToast({
                open: true,
                severity: "error",
                message: error.response?.data?.message
                    || "Details save nahi ho paayi. Retry karein.",
            });
        } finally {
            setSaving(false);
        }
    };

    const closeToast = () => {
        setToast((previous) => ({ ...previous, open: false }));
    };

    return (
        <div className="emp-pi-page">
            <div className="emp-pi-shell">
                <PersonalInfoHeader
                    loading={loading}
                    name={fullName}
                    role={role}
                    profilePhotoUrl={employee?.profilePhotoUrl}
                    initials={initials}
                    onBack={() => navigate("/my-profile")}
                />

                <main className="emp-pi-content">
                    {loadError && !loading ? (
                        <div className="emp-pi-error">
                            <p>{loadError}</p>
                            <Button variant="contained" onClick={loadProfile}>Retry</Button>
                        </div>
                    ) : (
                        <>
                            <InfoSection title="BASIC">
                                <InfoRow loading={loading} label="Full name" value={fullName} />
                                <InfoRow loading={loading} label="Employee ID" value={employee?.employeeCode} />
                                <InfoRow loading={loading} label="Date of birth" value={formatDate(employee?.dob)} />
                                <InfoRow loading={loading} label="Gender" value={employee?.gender} />
                            </InfoSection>

                            <InfoSection title="CONTACT">
                                <InfoRow
                                    id="emp-pi-mobile"
                                    loading={loading}
                                    label="Mobile"
                                    value={employee?.phone}
                                    editing={editing}
                                    editable
                                    inputType="tel"
                                    inputValue={form.phone}
                                    onChange={(value) => setField("phone", value)}
                                    error={formErrors.phone}
                                    placeholder="10 digit mobile number"
                                />
                                <InfoRow loading={loading} label="Email" value={employee?.email} />
                                <InfoRow
                                    id="emp-pi-address"
                                    loading={loading}
                                    label="Address"
                                    value={employee?.address}
                                    editing={editing}
                                    editable
                                    multiline
                                    inputValue={form.address}
                                    onChange={(value) => setField("address", value)}
                                    error={formErrors.address}
                                    placeholder="Enter address"
                                />
                            </InfoSection>

                            <InfoSection title="WORK">
                                <InfoRow loading={loading} label="Department" value={employee?.departmentName} />
                                <InfoRow loading={loading} label="Designation" value={employee?.designationTitle} />
                                <InfoRow
                                    loading={loading}
                                    label="Shift"
                                    value={
                                        employee?.shiftName
                                            ? `${employee.shiftName}${employee.shiftTiming ? ` (${employee.shiftTiming})` : ""}`
                                            : "Not assigned"
                                    }
                                />
                                <InfoRow loading={loading} label="Date of joining" value={formatDate(employee?.joiningDate)} />
                                <InfoRow loading={loading} label="Reporting manager" value={employee?.managerName} />
                            </InfoSection>

                            <InfoSection title="EMERGENCY CONTACT">
                                <InfoRow
                                    id="emp-pi-emergency-contact"
                                    loading={loading}
                                    label="Emergency contact"
                                    value={employee?.emergencyContact}
                                    editing={editing}
                                    editable
                                    inputValue={form.emergencyContact}
                                    onChange={(value) => setField("emergencyContact", value)}
                                    error={formErrors.emergencyContact}
                                    placeholder="Name and mobile number"
                                />
                            </InfoSection>
                        </>
                    )}
                </main>

                {!loading && !loadError && (
                    <EditActions
                        editing={editing}
                        saving={saving}
                        onEdit={startEditing}
                        onSave={saveDetails}
                        onCancel={cancelEditing}
                    />
                )}
            </div>

            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={closeToast}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert onClose={closeToast} severity={toast.severity} sx={{ width: "100%" }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default EmployeePersonalInfo;
