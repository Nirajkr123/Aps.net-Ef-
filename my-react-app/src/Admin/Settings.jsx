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
import "./AdminDashboard.css";

/* ---------- Static strength rules (used by both the meter & the rules list) ---------- */
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

    // Firebase user (page reload ke baad thodi der me milta hai, isliye state)
    const [fbUser, setFbUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    // Password form
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPasswords, setShowPasswords] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    // Inline field errors (clear on change → live feedback while typing)
    const [errors, setErrors] = useState({});

    // Caps Lock warning
    const [capsOn, setCapsOn] = useState(false);

    // Logout confirm dialog
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

    // Login type pehchano
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
                // ---- Rasta 1: Firebase email/password user ----
                const credential = EmailAuthProvider.credential(fbUser.email, oldPassword);
                await reauthenticateWithCredential(fbUser, credential);
                await updatePassword(fbUser, newPassword);
            } else {
                // ---- Rasta 2: Direct login user (backend) ----
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

    /* live: clear a field's error as soon as the user edits it */
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

    const PW_FIELD_PROPS = {
        type: showPasswords ? "text" : "password",
        autoComplete: "off",
    };

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
                    <div className="dash-header">
                        <div>
                            <h1 className="dash-title">Settings</h1>
                            <p className="dash-subtitle">Manage your account settings</p>
                        </div>
                    </div>

                    <div className="set-wrap">
                        {/* ===== Profile ===== */}
                        <section className="dash-card set-card">
                            <div className="set-card-head">
                                <span className="set-avatar" aria-hidden="true">
                                    {initials}
                                </span>
                                <div className="set-head-text">
                                    <h2 className="set-card-title">Profile Information</h2>
                                    <p className="set-card-sub">Your account details as stored in the system.</p>
                                </div>
                            </div>
                            <div className="set-info-grid">
                                <div className="set-info">
                                    <span className="set-info-label">Full Name</span>
                                    <span className="set-info-value">{displayName}</span>
                                </div>
                                <div className="set-info">
                                    <span className="set-info-label">Email</span>
                                    <span className="set-info-value">{user?.email || "—"}</span>
                                </div>
                                <div className="set-info">
                                    <span className="set-info-label">Role</span>
                                    <span className="set-info-value">
                                        <span className="dash-chip">{user?.role || "User"}</span>
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* ===== Change Password ===== */}
                        <section className="dash-card set-card">
                            <div className="set-card-head">
                                <span className="set-avatar set-avatar--lock" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                        <path d="M12 2a5 5 0 0 0-5 5v2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 7V7a3 3 0 1 1 6 0v2H9Z" />
                                    </svg>
                                </span>
                                <div className="set-head-text">
                                    <h2 className="set-card-title">Change Password</h2>
                                    <p className="set-card-sub">Pick something you don’t use anywhere else.</p>
                                </div>
                            </div>

                            {!authReady ? (
                                <p className="set-muted">Loading…</p>
                            ) : isGoogleOnly ? (
                                <div className="set-notice set-notice--info">
                                    You sign in with Google. Please change your password from your Google account.
                                </div>
                            ) : (
                                <form onSubmit={handleChangePassword} noValidate>
                                    <div className="set-form-grid">
                                        {/* Old password */}
                                        <div className="set-field">
                                            <label className="set-label" htmlFor="old-pw">Old Password</label>
                                            <input
                                                id="old-pw"
                                                className={`set-input ${errors.oldPassword ? "has-error" : ""}`}
                                                {...PW_FIELD_PROPS}
                                                autoComplete="current-password"
                                                {...oldField}
                                                aria-invalid={!!errors.oldPassword}
                                            />
                                            {errors.oldPassword && <span className="set-error">{errors.oldPassword}</span>}
                                        </div>

                                        {/* New password */}
                                        <div className="set-field">
                                            <label className="set-label" htmlFor="new-pw">New Password</label>
                                            <input
                                                id="new-pw"
                                                className={`set-input ${errors.newPassword ? "has-error" : ""}`}
                                                {...PW_FIELD_PROPS}
                                                autoComplete="new-password"
                                                {...newField}
                                                aria-invalid={!!errors.newPassword}
                                            />
                                            {errors.newPassword && <span className="set-error">{errors.newPassword}</span>}
                                        </div>

                                        {/* Strength meter */}
                                        {showStrength && (
                                            <div className="set-strength">
                                                <div className="set-strength-top">
                                                    <span>Password strength</span>
                                                    <span style={{ color: strengthMeta.color, fontWeight: 700 }}>
                                                        {strengthMeta.label}
                                                    </span>
                                                </div>
                                                <div className="set-strength-track">
                                                    {[1, 2, 3, 4].map((i) => (
                                                        <span
                                                            key={i}
                                                            className="set-strength-seg"
                                                            style={{ background: i <= score ? strengthMeta.color : "#e8eaf3" }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Rules checklist */}
                                        <ul className="set-rules">
                                            {RULES.map((r) => {
                                                const ok = r.test(newPassword);
                                                return (
                                                    <li key={r.id} className={ok ? "is-ok" : ""}>
                                                        <span className="set-rule-dot" aria-hidden="true">
                                                            {ok ? "✓" : "•"}
                                                        </span>
                                                        {r.label}
                                                    </li>
                                                );
                                            })}
                                        </ul>

                                        {/* Confirm password */}
                                        <div className="set-field">
                                            <label className="set-label" htmlFor="confirm-pw">Confirm New Password</label>
                                            <input
                                                id="confirm-pw"
                                                className={`set-input ${errors.confirmPassword ? "has-error" : ""}`}
                                                {...PW_FIELD_PROPS}
                                                autoComplete="new-password"
                                                {...confirmField}
                                                aria-invalid={!!errors.confirmPassword}
                                            />
                                            {errors.confirmPassword && (
                                                <span className="set-error">{errors.confirmPassword}</span>
                                            )}
                                        </div>

                                        {capsOn && <div className="set-notice set-notice--warn">Caps Lock is on.</div>}

                                        <label className="set-check">
                                            <input
                                                type="checkbox"
                                                checked={showPasswords}
                                                onChange={(e) => setShowPasswords(e.target.checked)}
                                            />
                                            <span>Show passwords</span>
                                        </label>

                                        {message.text && (
                                            <div
                                                className={`set-alert ${message.type === "success" ? "is-success" : "is-error"}`}
                                                role="status"
                                            >
                                                {message.text}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            className="dash-btn dash-btn-primary set-submit"
                                            disabled={loading}
                                        >
                                            {loading ? "Updating…" : "Update Password"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </section>

                        {/* ===== Danger Zone ===== */}
                        <section className="dash-card set-card set-card--danger">
                            <div className="set-card-head">
                                <span className="set-avatar set-avatar--danger" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                        <path d="M12 2 1 21h22L12 2Zm1 13h-2v-2h2v2Zm0 4h-2v-2h2v2Z" />
                                    </svg>
                                </span>
                                <div className="set-head-text">
                                    <h2 className="set-card-title">Danger Zone</h2>
                                    <p className="set-card-sub">Signing out ends your session on this device.</p>
                                </div>
                            </div>
                            <button type="button" className="dash-btn set-btn-danger" onClick={() => setConfirmLogout(true)}>
                                Logout
                            </button>
                        </section>
                    </div>
                </div>
            </div>

            {/* Logout confirmation */}
            {confirmLogout && (
                <div className="set-modal-backdrop" onClick={() => setConfirmLogout(false)}>
                    <div className="set-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <h3 className="set-modal-title">Log out?</h3>
                        <p className="set-modal-body">You’ll need to sign in again to continue.</p>
                        <div className="set-modal-actions">
                            <button className="dash-btn dash-btn-ghost" onClick={() => setConfirmLogout(false)}>
                                Stay
                            </button>
                            <button className="dash-btn set-btn-danger" onClick={handleLogout}>
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Settings;
