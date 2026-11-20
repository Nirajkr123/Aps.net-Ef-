import React from "react";
import { CircularProgress } from "@mui/material";

function EditProfileForm({ children, saving = false, onSave, onCancel }) {
    return (
        <div className="emp-prof-edit-wrap">
            {children}
            <div className="emp-prof-edit-actions">
                <button
                    type="button"
                    className="emp-prof-btn is-secondary"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="emp-prof-btn is-primary"
                    onClick={onSave}
                    disabled={saving}
                >
                    {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
                </button>
            </div>
        </div>
    );
}

export default EditProfileForm;
