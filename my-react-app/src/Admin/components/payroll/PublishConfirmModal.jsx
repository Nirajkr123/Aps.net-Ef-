import React from "react";
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from "@mui/material";
import { WarningAmberOutlined } from "@mui/icons-material";

function PublishConfirmModal({ open, run, payslips, busy, onClose, onConfirm }) {
    const total = Number(run?.employeeCount) || payslips.length;
    const warnings = payslips.filter((payslip) => Number(payslip.warningsCount) > 0);
    const publishLabel = run?.status === "APPROVED" ? "Publish" : "Approve & Publish";

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle className="payroll-dialog-title">
                {publishLabel}?
            </DialogTitle>
            <DialogContent>
                <p className="payroll-dialog-copy">
                    {total} payslips publish hongi. Ye wapas nahi hoega.
                </p>

                {warnings.length > 0 && (
                    <Alert
                        severity="error"
                        icon={<WarningAmberOutlined />}
                        className="payroll-dialog-warning"
                    >
                        <strong>{warnings.length} payslips mein problem hai.</strong>
                        <ul>
                            {warnings.map((payslip) => (
                                <li key={payslip.id}>
                                    {payslip.employeeName || `Employee #${payslip.employeeId}`}
                                    {Number(payslip.warningsCount) > 1
                                        ? ` · ${payslip.warningsCount} warnings`
                                        : ""}
                                </li>
                            ))}
                        </ul>
                    </Alert>
                )}
            </DialogContent>
            <DialogActions className="payroll-dialog-actions">
                <Button
                    type="button"
                    variant="outlined"
                    onClick={onClose}
                    disabled={!!busy}
                    className="payroll-secondary-btn"
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="contained"
                    onClick={onConfirm}
                    disabled={!!busy || warnings.length > 0}
                    className="payroll-primary-btn"
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    {busy ? "Publishing..." : publishLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default PublishConfirmModal;
