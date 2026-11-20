import React from "react";
import { Avatar, Skeleton } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";

const ROLE_LABELS = {
    EMPLOYEE: "Employee",
    MANAGER: "Manager",
    HR: "HR",
    OWNER: "Owner",
};

function PersonalInfoHeader({
    loading = false,
    name,
    role,
    profilePhotoUrl,
    initials,
    onBack,
}) {
    const roleLabel = ROLE_LABELS[role] || role || "-";

    return (
        <header className="emp-pi-header">
            <div className="emp-pi-header-top">
                <button
                    type="button"
                    className="emp-pi-back"
                    onClick={onBack}
                    aria-label="Back to profile"
                >
                    <ArrowBack />
                </button>
                <h1>Personal Info</h1>
                <span className="emp-pi-back-spacer" aria-hidden="true" />
            </div>

            {loading ? (
                <div className="emp-pi-identity emp-pi-identity-skeleton">
                    <Skeleton variant="circular" width={64} height={64} />
                    <Skeleton variant="text" width={150} height={26} />
                    <Skeleton variant="text" width={90} height={18} />
                </div>
            ) : (
                <div className="emp-pi-identity">
                    <Avatar className="emp-pi-avatar" src={profilePhotoUrl || undefined}>
                        {initials}
                    </Avatar>
                    <h2>{name || "-"}</h2>
                    <span>{roleLabel}</span>
                </div>
            )}
        </header>
    );
}

export default PersonalInfoHeader;
