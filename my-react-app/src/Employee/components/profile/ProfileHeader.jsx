import React from "react";
import { Avatar, Skeleton } from "@mui/material";
import { ArrowBack, EditOutlined } from "@mui/icons-material";

const ROLE_LABELS = {
    EMPLOYEE: "Employee",
    MANAGER: "Manager",
    HR: "HR",
    OWNER: "Owner",
};

const STATUS_META = {
    OnDuty: { label: "On Duty", tone: "is-on" },
    CheckedOut: { label: "Checked Out", tone: "is-done" },
    OnLeave: { label: "On Leave", tone: "is-leave" },
    NotCheckedIn: { label: "Not Checked In", tone: "is-off" },
};

function ProfileHeader({
    loading = false,
    displayName,
    initials,
    profilePhotoUrl,
    role,
    shiftLabel,
    status,
    onBack,
    onEdit,
}) {
    const statusMeta = STATUS_META[status] || STATUS_META.NotCheckedIn;
    const roleLabel = ROLE_LABELS[role] || role || "Employee";

    return (
        <header className="emp-profile-head">
            <div className="emp-profile-head-top">
                <button
                    type="button"
                    className="emp-profile-icon-btn"
                    onClick={onBack}
                    aria-label="Back to dashboard"
                >
                    <ArrowBack />
                </button>

                <h1>Profile</h1>

                <button
                    type="button"
                    className="emp-profile-icon-btn"
                    onClick={onEdit}
                    disabled={loading}
                    aria-label="Edit profile"
                >
                    <EditOutlined />
                </button>
            </div>

            {loading ? (
                <div className="emp-profile-head-skeleton">
                    <Skeleton variant="circular" width={84} height={84} />
                    <Skeleton variant="text" width={170} height={30} />
                    <Skeleton variant="rounded" width={150} height={24} sx={{ borderRadius: 999 }} />
                </div>
            ) : (
                <div className="emp-profile-identity">
                    <Avatar className="emp-profile-avatar" src={profilePhotoUrl || undefined}>
                        {initials}
                    </Avatar>

                    <h2>{displayName || "-"}</h2>

                    <div className="emp-profile-badges">
                        <span className="emp-profile-badge is-role">{roleLabel}</span>
                        <span className={`emp-profile-badge ${statusMeta.tone}`}>{statusMeta.label}</span>
                        {shiftLabel && (
                            <span className="emp-profile-badge is-shift">Shift · {shiftLabel}</span>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

export default ProfileHeader;
