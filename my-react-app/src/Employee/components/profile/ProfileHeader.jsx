import React, { useRef } from "react";
import { Avatar, CircularProgress, Skeleton, Tooltip } from "@mui/material";
import {
    ArrowBack,
    CameraAltOutlined,
    EditOutlined,
} from "@mui/icons-material";

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
    photoUploading = false,
    onPhotoSelect,
    role,
    status,
    onBack,
    onEdit,
}) {
    const fileRef = useRef(null);
    const statusMeta = STATUS_META[status] || STATUS_META.NotCheckedIn;
    const roleLabel = ROLE_LABELS[role] || role || "Employee";

    const handleFile = (event) => {
        const file = event.target.files?.[0];
        if (file && onPhotoSelect) onPhotoSelect(file);
        if (fileRef.current) fileRef.current.value = "";
    };

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

                <h1>My Profile</h1>

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
                    <div className="emp-profile-avatar-wrap">
                        <Avatar className="emp-profile-avatar" src={profilePhotoUrl || undefined}>
                            {initials}
                        </Avatar>

                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleFile}
                            hidden
                        />

                        <Tooltip title="Upload photo">
                            <button
                                type="button"
                                className="emp-profile-avatar-edit"
                                onClick={() => fileRef.current?.click()}
                                disabled={photoUploading}
                                aria-label="Upload profile photo"
                            >
                                {photoUploading
                                    ? <CircularProgress size={14} color="inherit" />
                                    : <CameraAltOutlined />}
                            </button>
                        </Tooltip>
                    </div>

                    <h2>{displayName}</h2>

                    <div className="emp-profile-badges">
                        <span className="emp-profile-badge is-role">{roleLabel}</span>
                        <span className={`emp-profile-badge ${statusMeta.tone}`}>{statusMeta.label}</span>
                    </div>
                </div>
            )}
        </header>
    );
}

export default ProfileHeader;
