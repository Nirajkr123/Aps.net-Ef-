import React from "react";
import {
    AccessTimeOutlined,
    BeachAccessOutlined,
    CancelOutlined,
    CheckCircleOutlined,
    EventBusyOutlined,
    RemoveCircleOutlined,
    ScheduleOutlined,
    WarningAmberOutlined,
} from "@mui/icons-material";

const STATUS_META = {
    "On Duty": { label: "On Duty", tone: "green", Icon: AccessTimeOutlined },
    Completed: { label: "Completed", tone: "blue", Icon: CheckCircleOutlined },
    "Not Checked In": { label: "Not Checked In", tone: "neutral", Icon: EventBusyOutlined },
    Present: { label: "Present", tone: "green", Icon: CheckCircleOutlined },
    Late: { label: "Late", tone: "amber", Icon: WarningAmberOutlined },
    Absent: { label: "Absent", tone: "red", Icon: CancelOutlined },
    "Half-day": { label: "Half Day", tone: "orange", Icon: ScheduleOutlined },
    HalfDay: { label: "Half Day", tone: "orange", Icon: ScheduleOutlined },
    Leave: { label: "Leave", tone: "blue", Icon: BeachAccessOutlined },
    "In progress": { label: "In progress", tone: "purple", Icon: ScheduleOutlined },
    "No checkout": { label: "No checkout", tone: "amber", Icon: WarningAmberOutlined },
    "No record": { label: "No record", tone: "neutral", Icon: RemoveCircleOutlined },
};

function AttendanceStatusBadge({ status, className = "" }) {
    const meta = STATUS_META[status] || {
        label: status || "No record",
        tone: "neutral",
        Icon: RemoveCircleOutlined,
    };
    const Icon = meta.Icon;

    return (
        <span className={`emp-att-badge is-${meta.tone} ${className}`.trim()}>
            <Icon aria-hidden="true" />
            <span>{meta.label}</span>
        </span>
    );
}

export default AttendanceStatusBadge;
