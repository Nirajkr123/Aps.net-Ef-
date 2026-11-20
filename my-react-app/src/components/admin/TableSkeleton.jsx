import React from "react";
import { Skeleton } from "@mui/material";

import "./adminUi.css";

function TableSkeleton({ rows = 6, columns = 4 }) {
    return (
        <div className="admin-table-skeleton" role="status" aria-label="Loading table rows">
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div className="admin-skeleton-row" key={`skeleton-row-${rowIndex}`}>
                    {Array.from({ length: columns }).map((__, columnIndex) => (
                        <Skeleton
                            key={`skeleton-cell-${rowIndex}-${columnIndex}`}
                            variant="rounded"
                            height={16}
                            sx={{ flex: columnIndex === 0 ? 1.4 : 1, borderRadius: 1 }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

export default TableSkeleton;
