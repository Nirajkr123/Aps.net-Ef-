import React, { useEffect, useMemo, useState } from "react";
import {
    Avatar,
    Box,
    Button,
    MenuItem,
    Pagination,
    TextField,
    Typography,
} from "@mui/material";
import {
    BuildOutlined,
    EditOutlined,
    SearchRounded,
} from "@mui/icons-material";

import { formatCurrency, getReviewStatus } from "./payrollUi";

const FILTERS = [
    { value: "all", label: "All" },
    { value: "ok", label: "OK" },
    { value: "lop", label: "LOP applied" },
    { value: "warning", label: "Warning" },
];

const PAGE_SIZE = 5;

function ReviewBadge({ status }) {
    return <span className={`payroll-review-badge is-${status.key}`}>{status.label}</span>;
}

function EmployeeCell({ payslip }) {
    const name = payslip.employeeName || "Employee";
    const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");

    return (
        <Box className="payroll-employee-cell">
            <Avatar className="payroll-employee-avatar">{initials || "E"}</Avatar>
            <Box className="payroll-employee-meta">
                <strong>{name}</strong>
                <span>{payslip.employeeCode || `Employee #${payslip.employeeId}`}</span>
            </Box>
        </Box>
    );
}

function PayslipReviewTable({ payslips, onEdit }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [search, filter]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        return payslips.filter((payslip) => {
            const haystack = `${payslip.employeeName || ""} ${payslip.employeeCode || ""}`.toLowerCase();
            const status = getReviewStatus(payslip);
            const matchesSearch = !term || haystack.includes(term);
            const matchesFilter = filter === "all" || status.key === filter;
            return matchesSearch && matchesFilter;
        });
    }, [filter, payslips, search]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return (
        <section className="payroll-review-card" aria-label="Review payslips">
            <div className="payroll-review-head">
                <div>
                    <h2>Review payslips</h2>
                    <p>Validate amounts, LOP and warnings before publishing.</p>
                </div>
                <div className="payroll-review-filters">
                    <TextField
                        size="small"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search employee"
                        className="payroll-search"
                        inputProps={{ "aria-label": "Search payslips" }}
                        InputProps={{
                            startAdornment: <SearchRounded className="payroll-search-icon" />,
                        }}
                    />
                    <TextField
                        select
                        size="small"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        className="payroll-filter"
                        inputProps={{ "aria-label": "Filter payslips" }}
                    >
                        {FILTERS.map((option) => (
                            <MenuItem value={option.value} key={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </div>
            </div>

            <div className="payroll-table-wrap">
                <table className="payroll-table">
                    <thead>
                        <tr>
                            <th scope="col">Employee</th>
                            <th scope="col" className="is-right">Gross</th>
                            <th scope="col" className="is-right">LOP days</th>
                            <th scope="col" className="is-right">Deductions</th>
                            <th scope="col" className="is-right">Net pay</th>
                            <th scope="col">Status</th>
                            <th scope="col" className="is-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((payslip) => {
                            const status = getReviewStatus(payslip);
                            const needsFix = status.key === "warning";
                            const lopDays = Number(payslip.lopDays || 0);

                            return (
                                <tr key={payslip.id} onClick={() => onEdit(payslip)}>
                                    <td>
                                        <EmployeeCell payslip={payslip} />
                                    </td>
                                    <td className="is-right payroll-money is-gross">
                                        {formatCurrency(payslip.gross)}
                                    </td>
                                    <td className={`is-right payroll-lop${lopDays > 0 ? " is-alert" : ""}`}>
                                        {lopDays.toFixed(2)}
                                    </td>
                                    <td className="is-right payroll-money is-deduction">
                                        {formatCurrency(payslip.totalDeductions)}
                                    </td>
                                    <td className="is-right payroll-money is-net">
                                        {formatCurrency(payslip.netPay)}
                                    </td>
                                    <td>
                                        <ReviewBadge status={status} />
                                    </td>
                                    <td className="is-right">
                                        <Button
                                            type="button"
                                            size="small"
                                            variant={needsFix ? "outlined" : "text"}
                                            className={`payroll-row-action${needsFix ? " is-fix" : ""}`}
                                            startIcon={needsFix ? <BuildOutlined /> : <EditOutlined />}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onEdit(payslip);
                                            }}
                                        >
                                            {needsFix ? "Fix" : "Edit"}
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {visible.length === 0 && (
                    <Typography className="payroll-table-empty">
                        Koi payslip is filter se match nahi hui.
                    </Typography>
                )}
            </div>

            <div className="payroll-review-footer">
                <span>
                    Showing {visible.length} of {filtered.length}
                </span>
                {pageCount > 1 && (
                    <Pagination
                        count={pageCount}
                        page={safePage}
                        onChange={(_event, nextPage) => setPage(nextPage)}
                        size="small"
                        shape="rounded"
                        siblingCount={0}
                        boundaryCount={1}
                        aria-label="Payroll payslip pages"
                    />
                )}
            </div>
        </section>
    );
}

export default PayslipReviewTable;
