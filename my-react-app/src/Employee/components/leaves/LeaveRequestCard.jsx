import React from "react";
import LeaveStatusBadge from "./LeaveStatusBadge";
import { formatRangeShort, typeColor, typeLabel } from "./leaveShared";

function LeaveRequestCard({ leave, onSelect }) {
    const dayLabel = `${leave.days} ${leave.days === 1 ? "day" : "days"}`;
    const dateLabel = formatRangeShort(leave.from, leave.to) || "—";

    return (
        <button
            type="button"
            className="emp-leave-request"
            onClick={() => onSelect(leave)}
            aria-label={`${typeLabel(leave.type)} leave, ${dateLabel}, ${dayLabel}, ${leave.status}`}
        >
            <span
                className="emp-leave-request-stripe"
                style={{ backgroundColor: typeColor(leave.type) }}
                aria-hidden="true"
            />

            <span className="emp-leave-request-main">
                <strong>{typeLabel(leave.type)}</strong>
                <span>{dateLabel} · {dayLabel}</span>
            </span>

            <LeaveStatusBadge status={leave.status} />
        </button>
    );
}

export default LeaveRequestCard;
