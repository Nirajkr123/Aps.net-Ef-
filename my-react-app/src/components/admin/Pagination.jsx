import React from "react";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";

import "./adminUi.css";

const buildPages = (current, total) => {
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }

    const pages = new Set([1, total, current, current - 1, current + 1]);
    const list = [...pages]
        .filter((page) => page >= 1 && page <= total)
        .sort((a, b) => a - b);

    const result = [];
    list.forEach((page, index) => {
        if (index > 0 && page - list[index - 1] > 1) {
            result.push(`ellipsis-${page}`);
        }
        result.push(page);
    });

    return result;
};

function Pagination({ page = 0, pageSize = 10, total = 0, onPageChange }) {
    if (total <= 0) return null;

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(page + 1, 1), pageCount);
    const from = (current - 1) * pageSize + 1;
    const to = Math.min(total, current * pageSize);
    const pages = buildPages(current, pageCount);

    const go = (next) => {
        if (next < 0 || next >= pageCount) return;
        onPageChange?.(next);
    };

    return (
        <nav className="admin-pagination" aria-label="Pagination">
            <span>
                Showing {from}–{to} of {total}
            </span>

            <div className="admin-pagination-controls">
                <button
                    type="button"
                    className="admin-page-btn"
                    aria-label="Previous page"
                    disabled={current <= 1}
                    onClick={() => go(current - 2)}
                >
                    <ChevronLeftRounded fontSize="small" />
                </button>

                {pages.map((item) =>
                    typeof item === "number" ? (
                        <button
                            key={item}
                            type="button"
                            className={`admin-page-btn${item === current ? " is-active" : ""}`}
                            aria-label={`Page ${item}`}
                            aria-current={item === current ? "page" : undefined}
                            onClick={() => go(item - 1)}
                        >
                            {item}
                        </button>
                    ) : (
                        <span key={item} className="admin-page-ellipsis" aria-hidden="true">
                            …
                        </span>
                    )
                )}

                <button
                    type="button"
                    className="admin-page-btn"
                    aria-label="Next page"
                    disabled={current >= pageCount}
                    onClick={() => go(current)}
                >
                    <ChevronRightRounded fontSize="small" />
                </button>
            </div>
        </nav>
    );
}

export default Pagination;
