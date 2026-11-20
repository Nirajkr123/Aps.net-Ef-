import React, { useCallback, useEffect, useId, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    IconButton,
    MenuItem,
    TextField,
    Typography,
    useMediaQuery,
} from "@mui/material";
import {
    CloseRounded,
    WarningAmberOutlined,
} from "@mui/icons-material";

import payrollService from "../../../services/payrollService";
import {
    formatCurrency,
    formatMonthYear,
    getRunStatusLabel,
    splitLineItems,
} from "./payrollUi";

const ADJUSTMENT_TYPES = [
    { value: "BONUS", label: "Bonus" },
    { value: "ADVANCE", label: "Advance" },
    { value: "ARREARS", label: "Arrears" },
];

function LineItems({ title, items, tone }) {
    return (
        <section className={`payroll-drawer-lines is-${tone}`}>
            <h4>{title}</h4>
            {items.length > 0 ? (
                <ul>
                    {items.map((item, index) => (
                        <li key={`${item.name}-${index}`}>
                            <span>{item.name}</span>
                            <strong>{formatCurrency(Math.abs(Number(item.amount)))}</strong>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>—</p>
            )}
        </section>
    );
}

function AdjustmentDrawer({ open, payslipId, runStatus, onClose, onSaved }) {
    const fullScreen = useMediaQuery("(max-width: 599.95px)");
    const titleId = useId();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ type: "BONUS", amount: "", note: "" });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const readOnly = runStatus !== "DRAFT";

    const loadDetail = useCallback(async () => {
        if (!payslipId) return;
        setLoading(true);
        setError("");

        try {
            const { data } = await payrollService.getPayslip(payslipId);
            setDetail(data);
        } catch {
            setError("Payslip detail load nahi hui.");
        } finally {
            setLoading(false);
        }
    }, [payslipId]);

    useEffect(() => {
        if (!open) return;
        setDetail(null);
        setForm({ type: "BONUS", amount: "", note: "" });
        setSaveError("");
        loadDetail();
    }, [loadDetail, open]);

    const lineItems = splitLineItems(detail?.items);
    const warnings = Array.isArray(detail?.warnings) ? detail.warnings : [];

    const handleSave = async () => {
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount === 0) {
            setSaveError("Amount zero nahi ho sakta.");
            return;
        }

        setSaving(true);
        setSaveError("");

        try {
            const signedAmount = form.type === "ADVANCE" ? -Math.abs(amount) : Math.abs(amount);
            const result = await payrollService.addAdjustment(payslipId, {
                type: form.type,
                amount: signedAmount,
                note: form.note.trim() || null,
            });
            onSaved(result);
        } catch (requestError) {
            setSaveError(
                requestError.response?.data?.message ||
                "Adjustment save nahi hui. Dobara koshish karein."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            fullScreen={fullScreen}
            aria-labelledby={titleId}
            slotProps={{
                paper: {
                    className: "payroll-drawer-paper",
                    sx: { overflow: "hidden" },
                },
            }}
        >
            <div className="payroll-drawer-head">
                <div>
                    <Typography className="payroll-drawer-kicker">Payslip detail</Typography>
                    <Typography id={titleId} className="payroll-drawer-title">
                        {detail?.employeeName || "Employee"}
                    </Typography>
                    <span className="payroll-drawer-subtitle">
                        {detail
                            ? `${formatMonthYear(detail.month, detail.year)} · ${getRunStatusLabel(runStatus)}`
                            : "Loading..."}
                    </span>
                </div>
                <IconButton
                    type="button"
                    onClick={onClose}
                    aria-label="Close payslip detail"
                    className="payroll-drawer-close"
                >
                    <CloseRounded />
                </IconButton>
            </div>

            <div className="payroll-drawer-body">
                {loading ? (
                    <Box className="payroll-drawer-loading">
                        <CircularProgress size={28} />
                    </Box>
                ) : error ? (
                    <Alert
                        severity="error"
                        action={
                            <Button color="inherit" size="small" onClick={loadDetail}>
                                Retry
                            </Button>
                        }
                    >
                        {error}
                    </Alert>
                ) : detail ? (
                    <>
                        <div className="payroll-drawer-metrics">
                            <div>
                                <span>Gross</span>
                                <strong>{formatCurrency(detail.gross)}</strong>
                            </div>
                            <div>
                                <span>Deductions</span>
                                <strong className="is-red">{formatCurrency(detail.totalDeductions)}</strong>
                            </div>
                            <div>
                                <span>Net pay</span>
                                <strong>{formatCurrency(detail.netPay)}</strong>
                            </div>
                            <div>
                                <span>LOP days</span>
                                <strong className={Number(detail.lopDays) > 0 ? "is-red" : ""}>
                                    {Number(detail.lopDays || 0).toFixed(2)}
                                </strong>
                            </div>
                        </div>

                        {warnings.length > 0 && (
                            <div className="payroll-drawer-warnings">
                                <h4>
                                    <WarningAmberOutlined />
                                    Warnings
                                </h4>
                                <ul>
                                    {warnings.map((warning, index) => (
                                        <li key={`${warning}-${index}`}>{warning}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="payroll-drawer-items">
                            <LineItems
                                title="Earnings"
                                items={lineItems.earnings}
                                tone="earning"
                            />
                            <LineItems
                                title="Deductions"
                                items={lineItems.deductions}
                                tone="deduction"
                            />
                        </div>

                        <div className="payroll-adjustment">
                            <div className="payroll-adjustment-head">
                                <h4>Add adjustment</h4>
                                {readOnly && <span>Read only</span>}
                            </div>

                            {readOnly ? (
                                <p className="payroll-readonly-note">
                                    Sirf draft payroll mein adjustment editable hai.
                                </p>
                            ) : (
                                <>
                                    <div className="payroll-adjustment-grid">
                                        <TextField
                                            select
                                            size="small"
                                            label="Type"
                                            value={form.type}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    type: event.target.value,
                                                }))
                                            }
                                            fullWidth
                                        >
                                            {ADJUSTMENT_TYPES.map((option) => (
                                                <MenuItem value={option.value} key={option.value}>
                                                    {option.label}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            size="small"
                                            label="Amount"
                                            type="number"
                                            value={form.amount}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    amount: event.target.value,
                                                }))
                                            }
                                            inputProps={{ min: "0", step: "0.01" }}
                                            fullWidth
                                        />
                                    </div>
                                    <TextField
                                        size="small"
                                        label="Note"
                                        value={form.note}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                note: event.target.value,
                                            }))
                                        }
                                        multiline
                                        minRows={2}
                                        inputProps={{ maxLength: 500 }}
                                        fullWidth
                                    />
                                    {saveError && <Alert severity="error">{saveError}</Alert>}
                                </>
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            <div className="payroll-drawer-footer">
                <Button
                    type="button"
                    variant="outlined"
                    onClick={onClose}
                    className="payroll-secondary-btn"
                >
                    Cancel
                </Button>
                {!readOnly && (
                    <Button
                        type="button"
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving || loading || !detail}
                        className="payroll-primary-btn"
                        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {saving ? "Saving..." : "Save"}
                    </Button>
                )}
            </div>
        </Dialog>
    );
}

export default AdjustmentDrawer;
