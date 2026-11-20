import React from "react";

const TONES = {
    Approved: "approved",
    Pending: "pending",
    Rejected: "rejected",
    Cancelled: "cancelled",
};

function LeaveStatusBadge({ status }) {
    const tone = TONES[status] || "neutral";

    return (
        <span className={`emp-leave-badge is-${tone}`}>
            {status || "Unknown"}
        </span>
    );
}

export default LeaveStatusBadge;
