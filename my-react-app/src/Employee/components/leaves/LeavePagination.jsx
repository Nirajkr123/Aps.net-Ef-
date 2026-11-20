import React from "react";
import { IconButton } from "@mui/material";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";

function LeavePagination({ page, pageCount, total, pageSize, onChange }) {
    if (total === 0) return null;

    const from = page * pageSize + 1;
    const to = Math.min(total, (page + 1) * pageSize);

    return (
        <div className="emp-leave-pagination">
            <span className="emp-leave-pagination-count">
                Showing {from}–{to} of {total}
            </span>

            <div className="emp-leave-pagination-controls">
                <IconButton
                    size="small"
                    aria-label="Previous page"
                    disabled={page <= 0}
                    onClick={() => onChange(page - 1)}
                >
                    <ChevronLeftRounded />
                </IconButton>

                <span>Page {page + 1} of {pageCount}</span>

                <IconButton
                    size="small"
                    aria-label="Next page"
                    disabled={page >= pageCount - 1}
                    onClick={() => onChange(page + 1)}
                >
                    <ChevronRightRounded />
                </IconButton>
            </div>
        </div>
    );
}

export default LeavePagination;
