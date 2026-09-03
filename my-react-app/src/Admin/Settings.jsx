import React from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import "./AdminDashboard.css";

function Settings() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "null");

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

    return (
        <div className="dash-page">
            <div className={`dash-main`}>
                <div className="dash-content">
                    <div className="dash-header">
                        <div>
                            <h1 className="dash-title">Settings</h1>
                            <p className="dash-subtitle">Manage your account settings</p>
                        </div>
                    </div>

                    <div style={{ maxWidth: 600, marginTop: 24 }}>
                        <div style={{
                            background: "#ffffff",
                            border: "1px solid #eceef5",
                            borderRadius: 16,
                            padding: 32,
                        }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: "#1f2233" }}>
                                Profile Information
                            </h2>

                            <div style={{ display: "grid", gap: 16 }}>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: "#8a8fa3", display: "block", marginBottom: 6 }}>
                                        Full Name
                                    </label>
                                    <p style={{ fontSize: 14, color: "#1f2233", margin: 0 }}>{displayName}</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: "#8a8fa3", display: "block", marginBottom: 6 }}>
                                        Email
                                    </label>
                                    <p style={{ fontSize: 14, color: "#1f2233", margin: 0 }}>{user?.email || "—"}</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: "#8a8fa3", display: "block", marginBottom: 6 }}>
                                        Role
                                    </label>
                                    <p style={{ fontSize: 14, color: "#1f2233", margin: 0 }}>{user?.role || "User"}</p>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            background: "#ffffff",
                            border: "1px solid #eceef5",
                            borderRadius: 16,
                            padding: 32,
                            marginTop: 16,
                        }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#1f2233" }}>
                                Danger Zone
                            </h2>
                            <p style={{ fontSize: 13, color: "#8a8fa3", marginBottom: 16 }}>
                                Sign out of your account.
                            </p>
                            <button
                                type="button"
                                onClick={handleLogout}
                                style={{
                                    padding: "10px 20px",
                                    background: "#f43f5e",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 10,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
