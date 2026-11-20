import React from "react";
import { Skeleton } from "@mui/material";

const STATUS_META = {
    OnDuty: { label: "On Duty", tone: "is-on" },
    CheckedOut: { label: "Checked Out", tone: "is-done" },
    OnLeave: { label: "On Leave", tone: "is-leave" },
    NotCheckedIn: { label: "Not Checked In", tone: "is-off" },
};

function ProfileBanner({
    loading = false,
    displayName,
    initials,
    profilePhotoUrl,
    employeeCode,
    designationTitle,
    departmentName,
    shiftLabel,
    status,
    profileComplete,
    onEdit,
}) {
    const statusMeta = STATUS_META[status] || STATUS_META.NotCheckedIn;
    const metaLine = [employeeCode, designationTitle, departmentName]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
        .join(" · ");

    return (
        <header className="emp-prof-banner">
            {loading ? (
                <div className="emp-prof-banner-loading">
                    <div className="emp-prof-banner-main">
                        <Skeleton variant="circular" width={72} height={72} />
                        <div className="emp-prof-banner-skeleton-text">
                            <Skeleton variant="text" width={210} height={32} />
                            <Skeleton variant="text" width={270} height={18} />
                            <Skeleton variant="rounded" width={190} height={22} sx={{ borderRadius: 999 }} />
                        </div>
                    </div>
                    <Skeleton variant="rounded" width={132} height={50} sx={{ borderRadius: 2 }} />
                </div>
            ) : (
                <>
                    <div className="emp-prof-banner-main">
                        <div className="emp-prof-banner-avatar">
                            {profilePhotoUrl ? (
                                <img src={profilePhotoUrl} alt="" />
                            ) : (
                                <span>{initials || "-"}</span>
                            )}
                        </div>

                        <div className="emp-prof-banner-identity">
                            <h1>{displayName || "-"}</h1>
                            <p>{metaLine || "-"}</p>
                            <div className="emp-prof-banner-badges">
                                {shiftLabel && (
                                    <span className="emp-profile-badge is-shift">
                                        Shift · {shiftLabel}
                                    </span>
                                )}
                                <span className={`emp-profile-badge ${statusMeta.tone}`}>
                                    {statusMeta.label}
                                </span>
                                <span className={`emp-profile-badge ${profileComplete ? "is-complete" : "is-incomplete"}`}>
                                    {profileComplete ? "Profile Complete" : "Profile Incomplete"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="emp-prof-banner-edit"
                        onClick={onEdit}
                    >
                        Edit Profile
                    </button>
                </>
            )}
        </header>
    );
}

export default ProfileBanner;
