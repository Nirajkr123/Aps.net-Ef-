import React, { useEffect, useState } from "react";
import {
    Alert,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
} from "@mui/material";
import { LockOutlined } from "@mui/icons-material";

import { formatMonthLabel, formatRegisterTimestamp } from "./attendanceRegisterUi";
import "./AttendanceRegister.css";

function AttendanceRegisterLockDialog({
    open,
    data,
    history = [],
    historyLoading = false,
    historyError = "",
    saving = false,
    error = "",
    onClose,
    onLock,
}) {
    const [reason, setReason] = useState("");
    const [formError, setFormError] = useState("");
    const locked = Boolean(data?.locked);

    useEffect(() => {
        if (!open) return;
        setReason("");
        setFormError("");
    }, [open]);

    const handleSubmit = () => {
        if (reason.trim().length < 5) {
            setFormError("Please enter a lock reason of at least 5 characters.");
            return;
        }
        setFormError("");
        onLock?.(reason.trim());
    };

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: "18px" } }}
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, fontWeight: 800 }}>
                <LockOutlined color="primary" />
                {locked ? "Reissue register lock" : "Lock attendance register"}
            </DialogTitle>

            <DialogContent>
                <div className="att-reg-lock-dialog">
                    {error && (
                        <Alert severity="error" sx={{ borderRadius: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Alert severity={locked ? "warning" : "info"} sx={{ borderRadius: 2 }}>
                        {locked ? (
                            <>
                                {formatMonthLabel(data?.month)} is locked as version{" "}
                                <strong>v{data?.lockVersion}</strong> by {data?.lockedBy || "an admin"}.
                                Reissuing creates a new snapshot version with the current
                                calculations. Payroll already processed against the old
                                version keeps its snapshot.
                            </>
                        ) : (
                            <>
                                Locking stores immutable per-employee day totals for{" "}
                                {formatMonthLabel(data?.month)}. Payroll runs use this snapshot,
                                so later attendance changes will not silently alter a processed
                                run.
                            </>
                        )}
                    </Alert>

                    {locked && (
                        <div className="att-reg-current-lock">
                            <span>Current lock</span>
                            <strong>Version {data?.lockVersion}</strong>
                            <p>
                                {formatRegisterTimestamp(data?.lockedAt)} ·{" "}
                                {data?.lockedBy || "—"}
                            </p>
                            {data?.lockReason && <p>{data.lockReason}</p>}
                        </div>
                    )}

                    <TextField
                        label="Reason"
                        size="small"
                        multiline
                        minRows={3}
                        required
                        fullWidth
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        error={Boolean(formError)}
                        helperText={formError || "Minimum 5 characters. Stored with the lock version."}
                        inputProps={{ maxLength: 500 }}
                    />

                    <section className="att-reg-lock-history">
                        <h3>Lock history</h3>
                        {historyLoading ? (
                            <div className="att-reg-lock-loading">
                                <CircularProgress size={20} />
                                <span>Loading versions…</span>
                            </div>
                        ) : historyError ? (
                            <Alert severity="error" sx={{ borderRadius: 2 }}>
                                {historyError}
                            </Alert>
                        ) : history.length === 0 ? (
                            <p className="att-reg-muted">No lock versions yet.</p>
                        ) : (
                            <ol>
                                {history.map((item) => (
                                    <li key={item.id}>
                                        <div>
                                            <strong>Version {item.version}</strong>
                                            <span>{formatRegisterTimestamp(item.lockedAt)}</span>
                                        </div>
                                        <p>
                                            {item.lockedBy || "—"}
                                            {item.payrollRunId ? ` · Payroll run #${item.payrollRunId}` : ""}
                                        </p>
                                        {item.reason && <p>{item.reason}</p>}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <button
                    type="button"
                    className="admin-btn is-ghost-dark"
                    onClick={onClose}
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="admin-btn is-primary-solid"
                    onClick={handleSubmit}
                    disabled={saving}
                >
                    {saving ? "Locking…" : locked ? "Reissue version" : "Lock month"}
                </button>
            </DialogActions>
        </Dialog>
    );
}

export default AttendanceRegisterLockDialog;
