import React from "react";
import {
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
} from "@mui/material";
import LeaveStatusBadge from "./LeaveStatusBadge";
import LeavePagination from "./LeavePagination";
import {
    formatDate,
    formatRangeShort,
    typeColor,
    typeLabel,
} from "./leaveShared";

const COLUMNS = [
    "Type",
    "Dates",
    "Days",
    "Applied on",
    "Approver",
    "Status",
    "Action",
];

function LeaveRequestsTable({
    leaves,
    loading,
    total,
    page,
    pageSize,
    pageCount,
    emptyMessage,
    onPageChange,
    onSelect,
    onCancel,
}) {
    const empty = !loading && leaves.length === 0;

    return (
        <section className="emp-leave-table-card" aria-label="Leave requests">
            {empty ? (
                <p className="emp-leave-empty-text emp-leave-table-empty">
                    {emptyMessage}
                </p>
            ) : (
                <div className="emp-leave-table-wrap">
                    <Table className="emp-leave-table" aria-label="My leave requests">
                        <TableHead>
                            <TableRow>
                                {COLUMNS.map((column) => (
                                    <th key={column} scope="col">
                                        {column}
                                    </th>
                                ))}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {loading
                                ? [0, 1, 2, 3, 4].map((row) => (
                                    <TableRow key={row}>
                                        {COLUMNS.map((column) => (
                                            <TableCell key={column}>
                                                <Skeleton variant="text" height={20} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                                : leaves.map((leave) => {
                                    const dateLabel = formatRangeShort(leave.from, leave.to) || "—";
                                    const dayLabel = `${leave.days} ${leave.days === 1 ? "day" : "days"}`;
                                    const label = typeLabel(leave.type);

                                    return (
                                        <TableRow
                                            key={leave.id}
                                            hover
                                            tabIndex={0}
                                            className="emp-leave-table-row"
                                            aria-label={`View ${label} leave, ${dateLabel}, ${leave.status}`}
                                            onClick={() => onSelect(leave)}
                                            onKeyDown={(event) => {
                                                if (event.target !== event.currentTarget) return;
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    onSelect(leave);
                                                }
                                            }}
                                        >
                                            <TableCell>
                                                <span className="emp-leave-table-type">
                                                    <span
                                                        className="emp-leave-table-dot"
                                                        style={{ backgroundColor: typeColor(leave.type) }}
                                                        aria-hidden="true"
                                                    />
                                                    {label}
                                                </span>
                                            </TableCell>
                                            <TableCell className="emp-leave-table-nowrap">
                                                {dateLabel}
                                            </TableCell>
                                            <TableCell>{dayLabel}</TableCell>
                                            <TableCell className="emp-leave-table-nowrap">
                                                {formatDate(leave.appliedOn)}
                                            </TableCell>
                                            <TableCell className="emp-leave-table-approver">
                                                {leave.reviewedBy || "—"}
                                            </TableCell>
                                            <TableCell>
                                                <LeaveStatusBadge status={leave.status} />
                                            </TableCell>
                                            <TableCell>
                                                {leave.status === "Pending" ? (
                                                    <button
                                                        type="button"
                                                        className="emp-leave-cancel-link"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onCancel(leave);
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                ) : (
                                                    <span className="emp-leave-table-muted">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                        </TableBody>
                    </Table>
                </div>
            )}

            <LeavePagination
                page={page}
                pageCount={pageCount}
                total={total}
                pageSize={pageSize}
                onChange={onPageChange}
            />
        </section>
    );
}

export default LeaveRequestsTable;
