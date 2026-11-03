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

function RequestSheet({ open, leave, onClose, onCancel }) {
    const dayLabel = leave
        ? `${leave.days} ${leave.days === 1 ? "day" : "days"}`
        : "—";

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "emp-leave-sheet-paper", elevation: 0 }}
        >
            <div className="emp-leave-sheet" role="dialog" aria-label="Leave request details">
                <div className="emp-leave-sheet-handle" aria-hidden="true" />

                <div className="emp-leave-sheet-head">
                    <div>
                        <span>Leave request</span>
                        <h2>
                            {leave ? typeLabel(leave.type) : "Request details"}
                        </h2>
                    </div>
                    <IconButton onClick={onClose} aria-label="Close leave request details">
                        <CloseRounded />
                    </IconButton>
                </div>

                {leave && (
                    <>
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
                    </>
                )}
            </div>
        </Drawer>
    );
}

export default RequestSheet;
