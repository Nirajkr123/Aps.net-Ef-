import React from "react";
import { Skeleton, TextField } from "@mui/material";

function InfoRow({
    id,
    label,
    value,
    loading = false,
    editing = false,
    editable = false,
    inputType = "text",
    inputValue = "",
    onChange,
    error = "",
    multiline = false,
    placeholder = "",
}) {
    const rowId = id || `emp-pi-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    if (loading) {
        return (
            <div className="emp-pi-row is-loading">
                <Skeleton variant="text" width="34%" height={14} />
                <Skeleton variant="text" width="68%" height={20} />
            </div>
        );
    }

    if (editing && editable) {
        return (
            <div className="emp-pi-row is-editing">
                <TextField
                    id={rowId}
                    label={label}
                    value={inputValue}
                    onChange={(event) => onChange?.(event.target.value)}
                    error={!!error}
                    helperText={error || " "}
                    fullWidth
                    size="small"
                    type={inputType}
                    multiline={multiline}
                    minRows={multiline ? 2 : undefined}
                    placeholder={placeholder}
                    className="emp-pi-input"
                    inputProps={{
                        maxLength: inputType === "tel" ? 10 : undefined,
                        inputMode: inputType === "tel" ? "numeric" : undefined,
                    }}
                />
            </div>
        );
    }

    const displayValue = value === null || value === undefined || String(value).trim() === ""
        ? "-"
        : value;

    return (
        <div className="emp-pi-row">
            <span className="emp-pi-label">{label}</span>
            <span className="emp-pi-value">{displayValue}</span>
        </div>
    );
}

export default InfoRow;
