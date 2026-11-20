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
import {
    formatShortDate,
    formatTime,
} from "../../../Employee/components/attendance/attendanceUtils";

const STATUS_OPTIONS = [
    { value: "Present", label: "Present" },
    { value: "Late", label: "Late" },
    { value: "Half-day", label: "Half-day" },
    { value: "Absent", label: "Absent" },
    { value: "Leave", label: "Leave" },
    { value: "Holiday", label: "Holiday" },
    { value: "MissingPunch", label: "Missing punch" },
];

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

const initialStatus = (row) => {
    const raw = String(row?.status || "").trim();
    const match = STATUS_OPTIONS.find(
        (option) => option.value.toLowerCase() === raw.toLowerCase()
    );
    return match?.value || "Present";
};

function AttendanceOverrideDrawer({
    open,
    row,
    onClose,
    onSubmit,
    saving = false,
    error = "",
}) {
    const [checkInTime, setCheckInTime] = useState("");
    const [checkOutTime, setCheckOutTime] = useState("");
    const [status, setStatus] = useState("Present");
    const [reason, setReason] = useState("");
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (!open) return;
        setCheckInTime(toDateTimeInput(row?.checkInTime));
        setCheckOutTime(toDateTimeInput(row?.checkOutTime));
        setStatus(initialStatus(row));
        setReason("");
        setFormError("");
    }, [open, row]);

    const handleSubmit = (event) => {
        event.preventDefault();
        setFormError("");

        if (checkInTime && checkOutTime && new Date(checkOutTime) <= new Date(checkInTime)) {
            setFormError("Check-out time must be after the check-in time.");
            return;
        }

        if (reason.trim().length < 5) {
            setFormError("Please enter an override reason of at least 5 characters.");
            return;
        }

        onSubmit?.({
            checkInTime: toApiDateTime(checkInTime),
            checkOutTime: toApiDateTime(checkOutTime),
            status,
            reason: reason.trim(),
        });
    };

    const employeeLabel = row?.employeeName || "Employee";
    const dateLabel = row?.__dateKey ? formatShortDate(row.__dateKey) : "—";
    const shiftLabel = row?.shiftName || "Unassigned";
    const currentIn = formatTime(row?.checkInTime);
    const currentOut = formatTime(row?.checkOutTime);

    return (
        <FormDrawer
            open={open}
            title="Override Attendance"
            onClose={onClose}
            onSubmit={handleSubmit}
            submitLabel="Save override"
            saving={saving}
            error={formError || error}
        >
            <div className="adm-att-override-summary">
                <div>
                    <span>Employee</span>
                    <strong>{employeeLabel}</strong>
                </div>
                <div>
                    <span>Date</span>
                    <strong>{dateLabel}</strong>
                </div>
                <div>
                    <span>Shift</span>
                    <strong>{shiftLabel}</strong>
                </div>
                <div>
                    <span>Current</span>
                    <strong>
                        {currentIn} → {currentOut}
                    </strong>
                </div>
            </div>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
                Times are in the company timezone. Saving clears the missed-punch flag and
                records an audit entry.
            </Alert>

            <div className="admin-form-row">
                <TextField
                    label="Check-in"
                    type="datetime-local"
                    size="small"
                    value={checkInTime}
                    onChange={(event) => setCheckInTime(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                    label="Check-out"
                    type="datetime-local"
                    size="small"
                    value={checkOutTime}
                    onChange={(event) => setCheckOutTime(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                />
            </div>

            <FormControl size="small" fullWidth>
                <InputLabel id="attendance-override-status">Status</InputLabel>
                <Select
                    labelId="attendance-override-status"
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

            <TextField
                label="Reason"
                size="small"
                multiline
                minRows={3}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                inputProps={{ maxLength: 500 }}
            />
        </FormDrawer>
    );
}

export default AttendanceOverrideDrawer;
