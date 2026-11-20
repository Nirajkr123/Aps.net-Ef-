import React from "react";

import TableSkeleton from "./TableSkeleton";
import "./adminUi.css";

function DataTable({
    columns = [],
    rows = [],
    rowKey,
    loading = false,
    skeletonRows = 6,
    onRowClick,
    empty,
    ariaLabel = "Data table",
}) {
    const keyOf = (row, index) => {
        if (typeof rowKey === "function") return rowKey(row, index);
        if (rowKey) return row[rowKey];
        return row?.id ?? index;
    };

    return (
        <div className="admin-table-card">
            {loading ? (
                <TableSkeleton rows={skeletonRows} columns={Math.max(columns.length, 3)} />
            ) : rows.length === 0 ? (
                empty || null
            ) : (
                <div className="admin-table-scroll">
                    <table className="admin-table" aria-label={ariaLabel}>
                        <thead>
                            <tr>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        style={{
                                            textAlign: column.align || "left",
                                            width: column.width,
                                        }}
                                    >
                                        {column.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr
                                    key={keyOf(row, index)}
                                    className={onRowClick ? "is-clickable" : undefined}
                                    onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                                >
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            style={{ textAlign: column.align || "left" }}
                                        >
                                            {column.render
                                                ? column.render(row, index)
                                                : row[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default DataTable;
