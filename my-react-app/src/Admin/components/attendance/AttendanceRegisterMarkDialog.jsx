import React, { useEffect, useState } from "react";
import {
    Alert,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from "@mui/material";

import FormDrawer from "../../../components/admin/FormDrawer";
import { formatShortDate } from "../../../Employee/components/attendance/attendanceUtils";
import { getCodeMeta } from "./attendanceRegisterUi";
import "./AttendanceRegister.css";

const STATUS_OPTIONS = [
    { value: "P", label: "P — Present" },
    { value: "LT", label: "LT — Late" },
    { value: "HD", label: "HD — Half day" },
    { value: "A", label: "A — Absent" },
    { value: "L", label: "L — Paid leave (register override)" },
    { value: "UL", label: "UL — Unpaid leave (register override)" },
    { value: "H", label: "H — Holiday (register override)" },
    { value: "WO", label: "WO — Week off (register override)" },
];

const WORKED_CODES = new Set(["P", "LT", "HD"]);

const pad = (value) => String(value).padStart(2, "0");

const toDateTimeInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
};

const toApiDateTime = (value) => {
    if (!value) return null;
    return value.length === 16 ? `${value}:00` : value;
};

const initialStatus = (code) => {
    const normalized = String(code || "").toUpperCase();
    return STATUS_OPTIONS.some((option) => option.value === normalized) ? normalized : "P";
};

function AttendanceRegisterMarkDialog({
    open,
    row,
    day,
    cell,
    saving = false,
    error = "",
    onSubmit,
    onClose,
}) {
    const [status, setStatus] = useState("P");
    const [checkInTime, setCheckInTime] = useState("");
    const [checkOutTime, setCheckOutTime] = useState("");
    const [reason, setReason] = useState("");
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (!open) return;
        const firstSegment = cell?.segments?.[0];
        setStatus(initialStatus(cell?.code || day?.code));
        setCheckInTime(toDateTimeInput(firstSegment?.checkInTime));
        setCheckOutTime(toDateTimeInput(firstSegment?.checkOutTime));
        setReason("");
        setFormError("");
    }, [open, cell, day]);

    const isWorked = WORKED_CODES.has(status);

    const handleSubmit = (event) => {
        event.preventDefault();
        setFormError("");

        if (reason.trim().length < 5) {
            setFormError("Please enter an audit reason of at least 5 characters.");
            return;
        }

        if (isWorked && checkInTime && checkOutTime && new Date(checkOutTime) <= new Date(checkInTime)) {
            setFormError("Check-out time must be after check-in time.");
            return;
        }

        onSubmit?.({
            employeeId: row?.employeeId || cell?.employeeId,
            date: day?.date || cell?.date,
            shiftAssignmentId: cell?.segments?.[0]?.shiftAssignmentId ?? null,
            status,
            checkInTime: isWorked ? toApiDateTime(checkInTime) : null,
            checkOutTime: isWorked ? toApiDateTime(checkOutTime) : null,
            reason: reason.trim(),
        });
    };

    const codeMeta = getCodeMeta(status);

    return (
        <FormDrawer
            open={open}
            title="Mark attendance"
            onClose={onClose}
            onSubmit={handleSubmit}
            submitLabel="Save attendance"
            saving={saving}
            error={formError || error}
        >
            <div className="adm-att-override-summary">
                <div>
                    <span>Employee</span>
                    <strong>{row?.employeeName || cell?.employeeName || "Employee"}</strong>
                </div>
                <div>
                    <span>Date</span>
                    <strong>{formatShortDate(day?.date || cell?.date)}</strong>
                </div>
                <div>
                    <span>Current</span>
                    <strong>{getCodeMeta(day?.code || cell?.code).label}</strong>
                </div>
                <div>
                    <span>Working hours</span>
                    <strong>{cell?.workingHours ? `${cell.workingHours}h` : "—"}</strong>
                </div>
            </div>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
                Saving writes an attendance override and an audit entry. Manual leave and
                holiday codes change the register only — use Leave Requests for leave quota.
            </Alert>

            <FormControl size="small" fullWidth>
                <InputLabel id="attendance-register-mark-status">Status</InputLabel>
                <Select
                    labelId="attendance-register-mark-status"
                    label="Status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                >
                    {STATUS_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {isWorked ? (
                <div className="admin-form-row">
                    <TextField
                        label="Check-in (optional)"
                        type="datetime-local"
                        size="small"
                        value={checkInTime}
                        onChange={(event) => setCheckInTime(event.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                        label="Check-out (optional)"
                        type="datetime-local"
                        size="small"
                        value={checkOutTime}
                        onChange={(event) => setCheckOutTime(event.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                </div>
            ) : (
                <div className={`att-reg-mark-hint is-${codeMeta.tone}`}>
                    <span className={`att-reg-code is-${codeMeta.tone}`}>
                        {codeMeta.short}
                    </span>
                    <span>
                        {codeMeta.label} will be recorded for the full day. Punch times are
                        not required for this status.
                    </span>
                </div>
            )}

            <TextField
                label="Reason"
                size="small"
                multiline
                minRows={3}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                inputProps={{ maxLength: 500 }}
                helperText="Minimum 5 characters. Stored in the audit log."
            />
        </FormDrawer>
    );
}

export default AttendanceRegisterMarkDialog;
