import React from "react";
import { Button, Drawer, IconButton } from "@mui/material";
import { CloseRounded, DeleteOutlineOutlined } from "@mui/icons-material";
import LeaveStatusBadge from "./LeaveStatusBadge";
import {
    formatDateTime,
    formatRangeShort,
    typeColor,
    typeLabel,
} from "./leaveShared";

function RequestDetailPanel({ open, leave, onClose, onCancel }) {
    if (!leave) return null;

    const dayLabel = `${leave.days} ${leave.days === 1 ? "day" : "days"}`;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "emp-leave-detail-paper", elevation: 0 }}
        >
            <div className="emp-leave-detail" role="dialog" aria-label="Leave request details">
                <div className="emp-leave-sheet-head">
                    <div>
                        <span>Leave request</span>
                        <h2>{typeLabel(leave.type)}</h2>
                    </div>
                    <IconButton onClick={onClose} aria-label="Close leave request details">
                        <CloseRounded />
                    </IconButton>
                </div>

                <div className="emp-leave-sheet-status">
                    <span
                        className="emp-leave-sheet-dot"
                        style={{ backgroundColor: typeColor(leave.type) }}
                        aria-hidden="true"
                    />
                    <LeaveStatusBadge status={leave.status} />
                </div>

                <div className="emp-leave-sheet-grid">
                    <div className="emp-leave-sheet-field">
                        <span>Dates</span>
                        <strong>{formatRangeShort(leave.from, leave.to) || "—"}</strong>
                    </div>
                    <div className="emp-leave-sheet-field">
                        <span>Duration</span>
                        <strong>{dayLabel}</strong>
                    </div>
                    <div className="emp-leave-sheet-field">
                        <span>Applied on</span>
                        <strong>{formatDateTime(leave.appliedOn)}</strong>
                    </div>
                    <div className="emp-leave-sheet-field">
                        <span>Approver</span>
                        <strong>{leave.reviewedBy || "Not reviewed yet"}</strong>
                    </div>
                    <div className="emp-leave-sheet-field is-wide">
                        <span>Reason</span>
                        <p>{leave.reason || "—"}</p>
                    </div>
                    <div className="emp-leave-sheet-field is-wide">
                        <span>Manager comment</span>
                        <p>{leave.adminComment || "—"}</p>
                    </div>
                </div>

                {leave.status === "Pending" && (
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<DeleteOutlineOutlined />}
                        className="emp-leave-cancel-button"
                        onClick={() => onCancel(leave)}
                    >
                        Cancel request
                    </Button>
                )}
            </div>
        </Drawer>
    );
}

export default RequestDetailPanel;
