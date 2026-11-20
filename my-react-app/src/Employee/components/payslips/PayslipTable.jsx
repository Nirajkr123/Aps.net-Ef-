import React from "react";
import {
    CircularProgress,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from "@mui/material";
import { DownloadOutlined } from "@mui/icons-material";

import PayslipStatusBadge from "./PayslipStatusBadge";
import {
    formatCurrency,
    formatMonthYear,
    getPayslipStatus,
} from "./payslipUi";

function DownloadButton({ payslip, downloading, onDownload, hiddenLabel }) {
    const meta = getPayslipStatus(payslip);
    const downloadingNow = downloading === payslip.id;

    return (
        <IconButton
            type="button"
            className="payslip-download-icon"
            aria-label={hiddenLabel}
            disabled={!meta.canDownload || downloadingNow}
            onClick={(event) => {
                event.stopPropagation();
                onDownload(payslip);
            }}
        >
            {downloadingNow ? (
                <CircularProgress size={18} color="inherit" />
            ) : (
                <DownloadOutlined />
            )}
        </IconButton>
    );
}

function PayslipTable({
    payslips,
    selectedId,
    onSelect,
    onDownload,
    downloadingId,
    amountsHidden,
    year,
}) {
    const handleKeyDown = (event, payslip) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(payslip);
        }
    };

    return (
        <div className="payslip-history">
            <div className="payslip-history-head">
                <h2>Previous payslips</h2>
                <span>{payslips.length} in {year}</span>
            </div>

            <TableContainer className="payslip-table-wrap">
                <Table className="payslip-table" aria-label="Previous payslips">
                    <TableHead>
                        <TableRow>
                            <TableCell>Month</TableCell>
                            <TableCell align="right">Gross</TableCell>
                            <TableCell align="right">Deductions</TableCell>
                            <TableCell align="right">Net pay</TableCell>
                            <TableCell align="center">Download</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {payslips.map((payslip) => {
                            const monthLabel = formatMonthYear(payslip.month, payslip.year);
                            const meta = getPayslipStatus(payslip);

                            return (
                                <TableRow
                                    key={payslip.id}
                                    hover
                                    selected={selectedId === payslip.id}
                                    tabIndex={0}
                                    aria-selected={selectedId === payslip.id}
                                    className="payslip-table-row"
                                    onClick={() => onSelect(payslip)}
                                    onKeyDown={(event) => handleKeyDown(event, payslip)}
                                >
                                    <TableCell>
                                        <span className="payslip-table-month">{monthLabel}</span>
                                        {meta.key === "corrected" && (
                                            <span className="payslip-table-note">Corrected</span>
                                        )}
                                    </TableCell>
                                    <TableCell align="right" className="payslip-money is-gross">
                                        {formatCurrency(payslip.gross, amountsHidden)}
                                    </TableCell>
                                    <TableCell align="right" className="payslip-money is-deduction">
                                        {formatCurrency(payslip.totalDeductions, amountsHidden)}
                                    </TableCell>
                                    <TableCell align="right" className="payslip-money is-net">
                                        {formatCurrency(payslip.netPay, amountsHidden)}
                                    </TableCell>
                                    <TableCell align="center">
                                        <DownloadButton
                                            payslip={payslip}
                                            downloading={downloadingId}
                                            onDownload={onDownload}
                                            hiddenLabel={`Download ${monthLabel} payslip`}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <div className="payslip-mobile-list" aria-label="Previous payslips">
                {payslips.map((payslip) => {
                    const monthLabel = formatMonthYear(payslip.month, payslip.year);

                    return (
                        <div
                            className={`payslip-mobile-item${selectedId === payslip.id ? " is-selected" : ""}`}
                            key={payslip.id}
                        >
                            <button
                                type="button"
                                className="payslip-mobile-select"
                                onClick={() => onSelect(payslip)}
                                aria-label={`View ${monthLabel} payslip`}
                            >
                                <span className="payslip-mobile-top">
                                    <strong>{monthLabel}</strong>
                                    <PayslipStatusBadge payslip={payslip} size="small" />
                                </span>
                                <span className="payslip-mobile-net">
                                    Net pay · {formatCurrency(payslip.netPay, amountsHidden)}
                                </span>
                            </button>
                            <DownloadButton
                                payslip={payslip}
                                downloading={downloadingId}
                                onDownload={onDownload}
                                hiddenLabel={`Download ${monthLabel} payslip`}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default PayslipTable;
