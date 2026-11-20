import React, { useId } from "react";
import { Alert, Dialog, IconButton, useMediaQuery } from "@mui/material";
import { CloseRounded } from "@mui/icons-material";

import "./adminUi.css";

function FormDrawer({
    open,
    title,
    onClose,
    onSubmit,
    submitLabel = "Save",
    saving = false,
    error = "",
    maxWidth = "sm",
    children,
}) {
    const fullScreen = useMediaQuery("(max-width: 599.95px)");
    const titleId = useId();

    const handleSubmit = (event) => {
        event.preventDefault();
        if (saving) return;
        onSubmit?.(event);
    };

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            fullWidth
            maxWidth={maxWidth}
            fullScreen={fullScreen}
            aria-labelledby={titleId}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: { xs: 0, sm: "18px" },
                        overflow: "hidden",
                    },
                },
            }}
        >
            <div className="admin-drawer admin-modal">
                <header className="admin-drawer-head">
                    <h2 id={titleId}>{title}</h2>
                    <IconButton
                        aria-label="Close dialog"
                        onClick={onClose}
                        disabled={saving}
                        size="small"
                    >
                        <CloseRounded fontSize="small" />
                    </IconButton>
                </header>

                <form className="admin-drawer-form" onSubmit={handleSubmit}>
                    <div className="admin-drawer-body">
                        {error && (
                            <Alert severity="error" sx={{ borderRadius: 2 }}>
                                {error}
                            </Alert>
                        )}
                        {children}
                    </div>

                    <footer className="admin-drawer-actions">
                        <button
                            type="button"
                            className="admin-btn is-ghost-dark"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="admin-btn is-primary-solid"
                            disabled={saving}
                        >
                            {saving ? "Saving…" : submitLabel}
                        </button>
                    </footer>
                </form>
            </div>
        </Dialog>
    );
}

export default FormDrawer;
