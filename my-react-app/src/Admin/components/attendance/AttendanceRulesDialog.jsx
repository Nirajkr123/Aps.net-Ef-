import React, { useEffect, useState } from "react";
import {
    Alert,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import { SettingsOutlined } from "@mui/icons-material";

function AttendanceRulesDialog({
    open,
    config,
    loading = false,
    saving = false,
    error = "",
    onClose,
    onSubmit,
}) {
    const [minutes, setMinutes] = useState("30");
    const [mode, setMode] = useState("WARN");
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (!open) return;
        setMinutes(String(config?.punchEarlyMinutes ?? 30));
        setMode(String(config?.enforcementMode || "WARN").toUpperCase());
        setFormError("");
    }, [open, config]);

    const submit = () => {
        const value = Number(minutes);
        if (!Number.isInteger(value) || value < 0 || value > 720) {
            setFormError("Enter a whole number between 0 and 720 minutes.");
            return;
        }

        setFormError("");
        onSubmit?.({ punchEarlyMinutes: value, enforcementMode: mode });
    };

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{ sx: { borderRadius: "18px" } }}
        >
            <DialogTitle
                sx={{ display: "flex", alignItems: "center", gap: 1.25, fontWeight: 800 }}
            >
                <SettingsOutlined color="primary" />
                Check-in window
            </DialogTitle>

            <DialogContent>
                {(formError || error) && (
                    <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
                        {formError || error}
                    </Alert>
                )}

                <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                    Employees can open the check-in button this many minutes before their
                    shift starts.
                </Typography>

                {loading ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Loading…
                    </Typography>
                ) : (
                    <TextField
                        label="Open check-in before shift (minutes)"
                        type="number"
                        size="small"
                        fullWidth
                        autoFocus
                        value={minutes}
                        onChange={(event) => {
                            setMinutes(event.target.value);
                            setFormError("");
                        }}
                        disabled={saving}
                        slotProps={{
                            htmlInput: { min: 0, max: 720, step: 5 },
                        }}
                        helperText="Default 30 minutes. A per-shift rule, if set, overrides this."
                    />
                )}

                <FormControl fullWidth size="small" sx={{ mt: 2 }} disabled={loading || saving}>
                    <InputLabel id="attendance-enforcement-mode">Outside-window punches</InputLabel>
                    <Select
                        labelId="attendance-enforcement-mode"
                        label="Outside-window punches"
                        value={mode}
                        onChange={(event) => setMode(event.target.value)}
                    >
                        <MenuItem value="WARN">Allow with warning</MenuItem>
                        <MenuItem value="ENFORCE">Block outside window</MenuItem>
                    </Select>
                </FormControl>

                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
                    Enforce mode makes the button available only inside the configured check-in window.
                </Typography>
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
                    onClick={submit}
                    disabled={saving || loading}
                >
                    {saving ? "Saving…" : "Save window"}
                </button>
            </DialogActions>
        </Dialog>
    );
}

export default AttendanceRulesDialog;
