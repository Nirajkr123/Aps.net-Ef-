import React from "react";
import { Dialog } from "@mui/material";
import { WarningAmberRounded } from "@mui/icons-material";

import "./adminUi.css";

function ConfirmModal({
    open,
    title = "Delete item",
    message = "Ye wapas nahi hoga.",
    confirmLabel = "Delete",
    danger = true,
    loading = false,
    blocked = false,
    blockedMessage = "",
    onConfirm,
    onClose,
}) {
    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            slotProps={{ paper: { sx: { borderRadius: "18px" } } }}
        >
            <div className="admin-confirm" role="alertdialog" aria-label={title}>
                <div className="admin-confirm-icon">
                    <WarningAmberRounded />
                </div>
                <h2>{title}</h2>
                <p>{blocked ? blockedMessage : message}</p>

                <div className="admin-confirm-actions">
                    <button
                        type="button"
                        className="admin-btn is-ghost-dark"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {blocked ? "Close" : "Cancel"}
                    </button>

                    {!blocked && (
                        <button
                            type="button"
                            className={`admin-btn${danger ? " is-danger" : " is-primary-solid"}`}
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading ? "Please wait…" : confirmLabel}
                        </button>
                    )}
                </div>
            </div>
        </Dialog>
    );
}

export default ConfirmModal;
