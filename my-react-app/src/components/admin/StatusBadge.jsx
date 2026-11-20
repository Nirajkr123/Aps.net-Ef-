import React from "react";

import "./adminUi.css";

const STATUS_CLASS = {
    active: "is-active",
    approved: "is-approved",
    published: "is-published",
    inactive: "is-inactive",
    rejected: "is-rejected",
    pending: "is-pending",
    draft: "is-draft",
    cancelled: "is-cancelled",
    canceled: "is-cancelled",
    present: "is-approved",
    late: "is-pending",
    "on duty": "is-active",
    "half-day": "is-pending",
    "half day": "is-pending",
    halfday: "is-pending",
    "missed checkout": "is-rejected",
    "no checkout": "is-rejected",
    absent: "is-inactive",
    leave: "is-draft",
    "no record": "is-neutral",
};

function StatusBadge({ status, label }) {
    const text = label || status || "—";
    const key = String(status || text).trim().toLowerCase();
    const tone = STATUS_CLASS[key] || "is-neutral";

    return (
        <span className={`admin-status ${tone}`}>
            <span className="admin-status-dot" aria-hidden="true" />
            {text}
        </span>
    );
}

export default StatusBadge;
