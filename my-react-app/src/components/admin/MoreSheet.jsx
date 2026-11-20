import React from "react";
import { Drawer, IconButton } from "@mui/material";
import { CloseRounded, LogoutRounded } from "@mui/icons-material";

import "./adminUi.css";

function MoreSheet({ open, items = [], onClose, onLogout }) {
    const handleSelect = (item) => {
        onClose?.();
        item.onClick?.();
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "admin-more-sheet" }}
        >
            <div className="admin-more-head">
                <h2>More</h2>
                <IconButton aria-label="Close more menu" onClick={onClose} size="small">
                    <CloseRounded fontSize="small" />
                </IconButton>
            </div>

            <div className="admin-more-list">
                {items.map((item) => {
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.key || item.label}
                            type="button"
                            className="admin-more-item"
                            onClick={() => handleSelect(item)}
                        >
                            <span className="admin-more-icon">
                                {Icon && <Icon fontSize="small" />}
                            </span>
                            <span>{item.label}</span>
                        </button>
                    );
                })}

                {onLogout && (
                    <button
                        type="button"
                        className="admin-more-item is-logout"
                        onClick={onLogout}
                    >
                        <span className="admin-more-icon">
                            <LogoutRounded fontSize="small" />
                        </span>
                        <span>Logout</span>
                    </button>
                )}
            </div>
        </Drawer>
    );
}

export default MoreSheet;
