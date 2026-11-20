import React, { useEffect, useState } from "react";
import {
    Alert,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Switch,
} from "@mui/material";
import { SettingsOutlined } from "@mui/icons-material";

import "./AttendanceRegister.css";

function AttendanceRegisterSettingsDialog({
    open,
    settings,
    saving = false,
    error = "",
    onClose,
    onSubmit,
}) {
    const [sandwich, setSandwich] = useState(false);
    const [halfDayLop, setHalfDayLop] = useState(true);

    useEffect(() => {
        if (!open) return;
        setSandwich(Boolean(settings?.sandwichRuleEnabled));
        setHalfDayLop(settings?.halfDayLopEnabled !== false);
    }, [open, settings]);

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: "18px" } }}
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, fontWeight: 800 }}>
                <SettingsOutlined color="primary" />
                Register rules
            </DialogTitle>

            <DialogContent>
                <div className="att-reg-settings">
                    {error && (
                        <Alert severity="error" sx={{ borderRadius: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                        These rules apply when the register is calculated and when a payroll
                        lock is created. Changing them recalculates open months.
                    </Alert>

                    <div className="att-reg-setting-row">
                        <div>
                            <strong>Sandwich rule</strong>
                            <p>
                                If an employee is absent or on unpaid leave immediately
                                before and after a holiday/week-off block, those off days
                                become LOP.
                            </p>
                        </div>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={sandwich}
                                    onChange={(event) => setSandwich(event.target.checked)}
                                />
                            }
                            label={sandwich ? "On" : "Off"}
                            labelPlacement="start"
                        />
                    </div>

                    <div className="att-reg-setting-row">
                        <div>
                            <strong>Half-day LOP</strong>
                            <p>
                                When attendance is half-day without a matching half-day
                                leave, deduct 0.5 payable day. Turn this off to pay half-days
                                in full.
                            </p>
                        </div>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={halfDayLop}
                                    onChange={(event) => setHalfDayLop(event.target.checked)}
                                />
                            }
                            label={halfDayLop ? "On" : "Off"}
                            labelPlacement="start"
                        />
                    </div>

                    <div className="att-reg-settings-meta">
                        <span>Timezone: {settings?.timezoneId || "Asia/Kolkata"}</span>
                        <span>Standard hours: {settings?.standardHours ?? 10}</span>
                    </div>
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
                    onClick={() =>
                        onSubmit?.({
                            sandwichRuleEnabled: sandwich,
                            halfDayLopEnabled: halfDayLop,
                        })
                    }
                    disabled={saving}
                >
                    {saving ? "Saving…" : "Save rules"}
                </button>
            </DialogActions>
        </Dialog>
    );
}

export default AttendanceRegisterSettingsDialog;
