import React from "react";
import { CircularProgress } from "@mui/material";

function EditActions({
    editing = false,
    saving = false,
    onEdit,
    onSave,
    onCancel,
}) {
    return (
        <div className="emp-pi-actions">
            <div className="emp-pi-actions-inner">
                {editing ? (
                    <>
                        <button
                            type="button"
                            className="emp-pi-action-btn is-secondary"
                            onClick={onCancel}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="emp-pi-action-btn is-primary"
                            onClick={onSave}
                            disabled={saving}
                        >
                            {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        className="emp-pi-action-btn is-primary"
                        onClick={onEdit}
                    >
                        Edit details
                    </button>
                )}
            </div>
        </div>
    );
}

export default EditActions;
