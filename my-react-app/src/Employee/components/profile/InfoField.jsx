import React from "react";
import { Skeleton } from "@mui/material";

const valueOrDash = (value) => (
    value === null || value === undefined || String(value).trim() === "" ? "-" : value
);

function InfoField({
    id,
    label,
    value,
    loading = false,
    editing = false,
    editable = false,
    type = "text",
    inputValue = "",
    onChange,
    error = "",
    placeholder = "",
    multiline = false,
    className = "",
}) {
    const fieldId = id || `emp-prof-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const inputProps = {
        id: fieldId,
        value: inputValue,
        onChange: (event) => onChange?.(event.target.value),
        placeholder,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": error ? `${fieldId}-error` : undefined,
        className: "emp-prof-input",
        inputMode: type === "tel" ? "numeric" : undefined,
        maxLength: type === "tel" ? 10 : undefined,
    };

    return (
        <div className={`emp-prof-field${className ? ` ${className}` : ""}`}>
            <label className="emp-prof-field-label" htmlFor={editing && editable ? fieldId : undefined}>
                {label}
            </label>

            {loading ? (
                <Skeleton variant="text" width="68%" height={24} />
            ) : editing && editable ? (
                <>
                    {multiline ? (
                        <textarea {...inputProps} rows={2} />
                    ) : (
                        <input {...inputProps} type={type} />
                    )}
                    {error && (
                        <span className="emp-prof-field-error" id={`${fieldId}-error`} role="alert">
                            {error}
                        </span>
                    )}
                </>
            ) : (
                <span className="emp-prof-field-value">{valueOrDash(value)}</span>
            )}
        </div>
    );
}

export default InfoField;
