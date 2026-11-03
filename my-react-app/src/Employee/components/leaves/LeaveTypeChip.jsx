import React from "react";
import { typeColor, typeLabel } from "./leaveShared";

function LeaveTypeChip({ item }) {
    const { type, remaining, used, total } = item;
    const color = typeColor(type);
    const label = typeLabel(type);
    const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

    return (
        <div className="emp-leave-type-chip">
            <div className="emp-leave-type-chip-top">
                <span
                    className="emp-leave-type-dot"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                />
                <div className="emp-leave-type-copy">
                    <strong>{label}</strong>
                    <span>
                        {remaining} / {total} left
                    </span>
                </div>
            </div>

            <div
                className="emp-leave-type-progress"
                role="progressbar"
                aria-label={`${label}: ${used} of ${total} days used`}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={used}
            >
                <span style={{ width: `${usedPct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
}

export default LeaveTypeChip;
