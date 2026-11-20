import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    signOut,
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
} from "firebase/auth";
import { auth } from "../firebase";
import http from "../services/http";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { ConfirmModal, PageHeader } from "../components/admin";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import "./AdminDashboard.css";
import "./Settings.css";

const RULES = [
    { id: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
    { id: "case", label: "One uppercase & one lowercase letter", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
    { id: "num", label: "At least one number", test: (v) => /\d/.test(v) },
    { id: "sym", label: "At least one special character", test: (v) => /[^\w\s]/.test(v) },
];

const strengthOf = (v) => {
    if (!v) return 0;
    return RULES.filter((r) => r.test(v)).length;
};

const STRENGTH_META = [
    { label: "Too weak", color: "#ef4444" },
    { label: "Weak", color: "#f59e0b" },
    { label: "Fair", color: "#eab308" },
    { label: "Good", color: "#22c55e" },
    { label: "Strong", color: "#16a34a" },
];

function Settings() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const [collapsed, setCollapsed] = useState(false);

    const [fbUser, setFbUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPasswords, setShowPasswords] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const [errors, setErrors] = useState({});
    const [capsOn, setCapsOn] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setFbUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    const handleLogout = async () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        await signOut(auth);
        navigate("/login");
    };

    const displayName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email ||
          "User"
        : "Guest";

    const initials = (() => {
        const base = user
            ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
            : "";
        if (base) {
            return base
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0].toUpperCase())
                .join("");
        }
        return (user?.email || "G").slice(0, 2).toUpperCase();
    })();

    const providers = fbUser ? fbUser.providerData.map((p) => p.providerId) : [];
    const hasPasswordProvider = providers.includes("password");
    const isGoogleOnly = !!fbUser && !hasPasswordProvider;

    const showMsg = (type, text) => setMessage({ type, text });

    const firebaseErrorText = (code) => {
        switch (code) {
            case "auth/wrong-password":
            case "auth/invalid-credential":
                return "Old password is incorrect";
            case "auth/weak-password":
                return "New password is too weak";
            case "auth/too-many-requests":
                return "Too many attempts. Please try again later";
            case "auth/requires-recent-login":
                return "Please logout and login again, then retry";
            default:
                return "Could not change password. Try again";
        }
    };

    const validate = () => {
        const next = {};
        if (!oldPassword) next.oldPassword = "Old password is required";
        if (!newPassword) next.newPassword = "New password is required";
        else {
            if (newPassword.length < 8) next.newPassword = "Must be at least 8 characters";
            if (oldPassword && oldPassword === newPassword)
                next.newPassword = "New password must be different from old password";
        }
        if (!confirmPassword) next.confirmPassword = "Please confirm your new password";
        else if (newPassword && confirmPassword !== newPassword)
            next.confirmPassword = "Passwords do not match";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        if (!validate()) return;

        setLoading(true);
        try {
            if (hasPasswordProvider) {
                const credential = EmailAuthProvider.credential(fbUser.email, oldPassword);
                await reauthenticateWithCredential(fbUser, credential);
                await updatePassword(fbUser, newPassword);
            } else {
                await http.post("/api/user/change-password", { oldPassword, newPassword });
            }

            showMsg("success", "Password changed successfully");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setErrors({});
        } catch (err) {
            showMsg("error", err.code ? firebaseErrorText(err.code) : (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const trackCaps = (e) => setCapsOn(e.getModifierState("CapsLock"));

    const bind = (field, setter) => ({
        value: field === "old" ? oldPassword : field === "new" ? newPassword : confirmPassword,
        onChange: (e) => {
            setter(e.target.value);
            setMessage({ type: "", text: "" });
            if (errors[field]) setErrors((s) => ({ ...s, [field]: undefined }));
        },
        onKeyUp: trackCaps,
        onKeyDown: trackCaps,
        onBlur: () => setCapsOn(false),
    });

    const oldField = bind("old", setOldPassword);
    const newField = bind("new", setNewPassword);
    const confirmField = bind("confirm", setConfirmPassword);

    const score = useMemo(() => strengthOf(newPassword), [newPassword]);
    const strengthMeta = STRENGTH_META[score];
    const showStrength = newPassword.length > 0;
    const inputType = showPasswords ? "text" : "password";

    return (
        <div className="dash-page">
            <Sidebar
                activeKey="settings"
                onLogout={handleLogout}
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
            />

            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    userName={displayName}
                    userRole={user?.role || "Administrator"}
                    user={user}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed((c) => !c)}
                    searchPlaceholder="Search settings..."
                    onLogout={handleLogout}
                />

                <div className="dash-content">
                    <PageHeader
                        title="Settings"
                        subtitle="Manage your account details and security."
                    />

                    <div className="settings-grid">
                        <section className="settings-card">
                            <div className="settings-card-head">
                                <span className="settings-avatar" aria-hidden="true">
                                    {initials}
                                </span>
                                <div>
                                    <h2 className="settings-title">Profile information</h2>
                                    <p className="settings-sub">Account details stored in the system.</p>
                                </div>
                            </div>

                            <div className="settings-info-grid">
                                <div className="settings-info">
                                    <span className="settings-label">Full name</span>
                                    <span className="settings-value">{displayName}</span>
                                </div>
                                <div className="settings-info">
                                    <span className="settings-label">Email</span>
                                    <span className="settings-value">{user?.email || "—"}</span>
                                </div>
                                <div className="settings-info">
                                    <span className="settings-label">Role</span>
                                    <span className="settings-value">
                                        <span className="settings-role">{user?.role || "User"}</span>
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section className="settings-card">
                            <div className="settings-card-head">
                                <span className="settings-avatar is-lock" aria-hidden="true">
                                    <LockResetRoundedIcon fontSize="small" />
                                </span>
                                <div>
                                    <h2 className="settings-title">Change password</h2>
                                    <p className="settings-sub">Pick something you don’t use anywhere else.</p>
                                </div>
                            </div>

                            {!authReady ? (
                                <p className="settings-muted">Loading…</p>
                            ) : isGoogleOnly ? (
                                <Alert severity="info" sx={{ borderRadius: "12px" }}>
                                    You sign in with Google. Please change your password from your Google account.
                                </Alert>
                            ) : (
                                <form className="settings-form" onSubmit={handleChangePassword} noValidate>
                                    <TextField
                                        label="Old password"
                                        type={inputType}
                                        size="small"
                                        fullWidth
                                        autoComplete="current-password"
                                        error={!!errors.oldPassword}
                                        {...oldField}
                                    />
                                    {errors.oldPassword && (
                                        <span className="settings-error">{errors.oldPassword}</span>
                                    )}

                                    <TextField
                                        label="New password"
                                        type={inputType}
                                        size="small"
                                        fullWidth
                                        autoComplete="new-password"
                                        error={!!errors.newPassword}
                                        {...newField}
                                    />
                                    {errors.newPassword && (
                                        <span className="settings-error">{errors.newPassword}</span>
                                    )}

                                    {showStrength && (
                                        <div className="settings-strength">
                                            <div className="settings-strength-head">
                                                <span>Password strength</span>
                                                <span style={{ color: strengthMeta.color, fontWeight: 700 }}>
                                                    {strengthMeta.label}
                                                </span>
                                            </div>
                                            <div className="settings-strength-track">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <span
                                                        key={i}
                                                        className="settings-strength-seg"
                                                        style={{
                                                            background:
                                                                i <= score ? strengthMeta.color : "#e8eaf3",
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <ul className="settings-rules">
                                        {RULES.map((r) => {
                                            const ok = r.test(newPassword);
                                            return (
                                                <li key={r.id} className={ok ? "is-ok" : ""}>
                                                    <span className="settings-rule-dot" aria-hidden="true">
                                                        {ok ? "✓" : "•"}
                                                    </span>
                                                    {r.label}
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    <TextField
                                        label="Confirm new password"
                                        type={inputType}
                                        size="small"
                                        fullWidth
                                        autoComplete="new-password"
                                        error={!!errors.confirmPassword}
                                        {...confirmField}
                                    />
                                    {errors.confirmPassword && (
                                        <span className="settings-error">{errors.confirmPassword}</span>
                                    )}

                                    {capsOn && (
                                        <Alert severity="warning" sx={{ borderRadius: "12px" }}>
                                            Caps Lock is on.
                                        </Alert>
                                    )}

                                    <label className="settings-check">
                                        <input
                                            type="checkbox"
                                            checked={showPasswords}
                                            onChange={(e) => setShowPasswords(e.target.checked)}
                                        />
                                        <span>Show passwords</span>
                                    </label>

                                    {message.text && (
                                        <Alert severity={message.type} sx={{ borderRadius: "12px" }} role="status">
                                            {message.text}
                                        </Alert>
                                    )}

                                    <div className="settings-actions">
                                        <button
                                            type="submit"
                                            className="admin-btn is-primary-solid"
                                            disabled={loading}
                                        >
                                            {loading ? "Updating…" : "Update password"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </section>

                        <section className="settings-card is-danger">
                            <div className="settings-card-head">
                                <span className="settings-avatar is-danger" aria-hidden="true">
                                    <WarningAmberRoundedIcon fontSize="small" />
                                </span>
                                <div>
                                    <h2 className="settings-title">Danger zone</h2>
                                    <p className="settings-sub">Signing out ends your session on this device.</p>
                                </div>
                            </div>
                            <div className="settings-actions">
                                <button
                                    type="button"
                                    className="admin-btn is-danger"
                                    onClick={() => setConfirmLogout(true)}
                                >
                                    Logout
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <ConfirmModal
                open={confirmLogout}
                title="Log out?"
                message="You’ll need to sign in again to continue."
                confirmLabel="Log out"
                onConfirm={handleLogout}
                onClose={() => setConfirmLogout(false)}
            />
        </div>
    );
}

export default Settings;
