import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Button,
    CircularProgress,
    Drawer,
    IconButton,
    MenuItem,
    TextField,
} from "@mui/material";
import { CloseRounded, EventOutlined } from "@mui/icons-material";
import {
    REASON_MIN_LENGTH,
    countLeaveDays,
    remainingOf,
    todayISO,
    validateLeaveRequest,
} from "../../../services/leaveService";
import {
    balanceTypes,
    typeLabel,
} from "./leaveShared";

const EMPTY_FORM = { type: "", from: "", to: "", reason: "" };

function ApplyLeaveForm({
    open,
    balance,
    existingLeaves,
    submitting,
    onClose,
    onSubmit,
}) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});

    const types = useMemo(() => balanceTypes(balance), [balance]);
    const totalDays = useMemo(
        () => countLeaveDays(form.from, form.to),
        [form.from, form.to]
    );
    const remaining = form.type ? remainingOf(balance, form.type) : null;

    useEffect(() => {
        if (open) {
            setForm(EMPTY_FORM);
            setErrors({});
        }
    }, [open]);

    useEffect(() => {
        if (!form.from) return;
        setForm((previous) => (
            previous.to && previous.to < previous.from
                ? { ...previous, to: "" }
                : previous
        ));
    }, [form.from]);

    const setField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setErrors((previous) => {
            if (!previous[field]) return previous;
            const next = { ...previous };
            delete next[field];
            return next;
        });
    };

    const validate = () => {
        const result = validateLeaveRequest(form, {
            balance,
            existingLeaves,
        });

        if (result.ok) {
            setErrors({});
            return true;
        }

        setErrors({ [result.field]: result.message });
        return false;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitting || !validate()) return;

        try {
            await onSubmit({
                type: form.type,
                from: form.from,
                to: form.to,
                reason: form.reason.trim(),
            });
        } catch (error) {
            setErrors({
                [error?.field || "form"]: error?.message || "Leave request submit nahi ho paayi.",
            });
        }
    };

    const reasonLength = form.reason.trim().length;

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={submitting ? undefined : onClose}
            PaperProps={{ className: "emp-leave-form-paper", elevation: 0 }}
        >
            <form
                className="emp-leave-form"
                onSubmit={handleSubmit}
                role="dialog"
                aria-label="Apply for leave"
            >
                <div className="emp-leave-sheet-handle" aria-hidden="true" />

                <div className="emp-leave-sheet-head">
                    <div>
                        <span>New request</span>
                        <h2>Apply Leave</h2>
                    </div>
                    <IconButton
                        onClick={onClose}
                        aria-label="Close apply leave form"
                        disabled={submitting}
                    >
                        <CloseRounded />
                    </IconButton>
                </div>

                {errors.form && (
                    <Alert severity="error" className="emp-leave-form-alert">
                        {errors.form}
                    </Alert>
                )}

                <div className="emp-leave-form-body">
                    <TextField
                        select
                        fullWidth
                        label="Leave type"
                        value={form.type}
                        onChange={(event) => setField("type", event.target.value)}
                        error={Boolean(errors.type)}
                        helperText={
                            errors.type
                            || (
                                types.length === 0
                                    ? "Leave balance load nahi hua. Page refresh karein."
                                    : remaining !== null
                                        ? `${remaining} ${remaining === 1 ? "day" : "days"} left · balance is deducted after approval`
                                        : "Select the leave type you want to use"
                            )
                        }
                        disabled={submitting || types.length === 0}
                    >
                        <MenuItem value="" disabled>
                            {types.length === 0 ? "Balance unavailable" : "Select leave type"}
                        </MenuItem>
                        {types.map((type) => (
                            <MenuItem key={type} value={type}>
                                {typeLabel(type)} ({remainingOf(balance, type)} left)
                            </MenuItem>
                        ))}
                    </TextField>

                    <div className="emp-leave-date-row">
                        <TextField
                            fullWidth
                            label="From date"
                            type="date"
                            value={form.from}
                            onChange={(event) => setField("from", event.target.value)}
                            error={Boolean(errors.from)}
                            helperText={errors.from || "Cannot be a past date"}
                            disabled={submitting}
                            slotProps={{
                                inputLabel: { shrink: true },
                                htmlInput: { min: todayISO() },
                            }}
                        />
                        <TextField
                            fullWidth
                            label="To date"
                            type="date"
                            value={form.to}
                            onChange={(event) => setField("to", event.target.value)}
                            error={Boolean(errors.to)}
                            helperText={errors.to || "Must be on or after from date"}
                            disabled={submitting}
                            slotProps={{
                                inputLabel: { shrink: true },
                                htmlInput: { min: form.from || todayISO() },
                            }}
                        />
                    </div>

                    <div className={`emp-leave-days-box${errors.days ? " has-error" : ""}`}>
                        <div>
                            <span>Total days</span>
                            <small>All calendar days counted (current API rule)</small>
                        </div>
                        <strong>{totalDays} {totalDays === 1 ? "day" : "days"}</strong>
                    </div>

                    {errors.days && (
                        <p className="emp-leave-field-error">{errors.days}</p>
                    )}

                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={6}
                        label="Reason"
                        placeholder="Why are you applying for this leave?"
                        value={form.reason}
                        onChange={(event) => setField("reason", event.target.value)}
                        error={Boolean(errors.reason)}
                        helperText={
                            errors.reason
                            || `Minimum ${REASON_MIN_LENGTH} characters (${reasonLength}/${REASON_MIN_LENGTH})`
                        }
                        disabled={submitting}
                    />
                </div>

                <div className="emp-leave-form-actions">
                    <Button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="emp-leave-form-cancel"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={submitting || types.length === 0}
                        className="emp-leave-form-submit"
                    >
                        {submitting ? (
                            <>
                                <CircularProgress size={18} color="inherit" />
                                Sending…
                            </>
                        ) : (
                            <>
                                <EventOutlined />
                                Submit request
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Drawer>
    );
}

export default ApplyLeaveForm;
