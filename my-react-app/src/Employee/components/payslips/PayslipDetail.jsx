import React from "react";
import { Button, CircularProgress } from "@mui/material";
import { DownloadOutlined, RefreshOutlined } from "@mui/icons-material";

import AmountToggle from "./AmountToggle";
import EarningsDeductions from "./EarningsDeductions";
import PayslipStatusBadge from "./PayslipStatusBadge";
import { formatCurrency, formatMonthYear, getPayslipStatus } from "./payslipUi";

function PayslipDetail({
    payslip,
    detail,
    detailLoading,
    detailError,
    onRetryDetail,
    amountsHidden,
    onToggleAmounts,
    onDownload,
    downloading,
}) {
    const record = detail || payslip;
    const meta = getPayslipStatus(record);
    const processing = meta.key === "processing";
    const corrected = meta.key === "corrected";

    return (
        <div className="payslip-detail">
            <div className="payslip-detail-head">
                <div className="payslip-detail-period">
                    <span className="payslip-month">
                        {formatMonthYear(record?.month, record?.year, true)}
                    </span>
                    {corrected && (
                        <span className="payslip-corrected-note">Corrected version</span>
                    )}
                </div>
                <PayslipStatusBadge payslip={record} />
            </div>

            <div className="payslip-net">
                <div className="payslip-net-label">
                    <span>Net pay</span>
                    <AmountToggle hidden={amountsHidden} onToggle={onToggleAmounts} />
                </div>
                <strong className="payslip-net-amount">
                    {formatCurrency(record?.netPay, amountsHidden)}
                </strong>
            </div>

            <div className="payslip-amount-boxes">
                <div className="payslip-amount-box is-gross">
                    <span>Gross</span>
                    <strong>{formatCurrency(record?.gross, amountsHidden)}</strong>
                </div>
                <div className="payslip-amount-box is-deduction">
                    <span>Deductions</span>
                    <strong>{formatCurrency(record?.totalDeductions, amountsHidden)}</strong>
                </div>
            </div>

            <EarningsDeductions
                items={detail?.items}
                hidden={amountsHidden}
                loading={detailLoading}
            />

            {detailError && (
                <div className="payslip-inline-error" role="alert">
                    <span>Payslip detail load nahi hui.</span>
                    <button type="button" onClick={onRetryDetail}>
                        <RefreshOutlined fontSize="small" />
                        Retry
                    </button>
                </div>
            )}

            {processing && (
                <p className="payslip-processing-note">Payslip abhi taiyar ho rahi hai.</p>
            )}

            <Button
                type="button"
                variant="contained"
                fullWidth
                className="payslip-download-btn"
                onClick={onDownload}
                disabled={processing || downloading}
                startIcon={
                    downloading ? (
                        <CircularProgress size={18} color="inherit" />
                    ) : (
                        <DownloadOutlined />
                    )
                }
            >
                {downloading ? "Downloading..." : "Download PDF"}
            </Button>
        </div>
    );
}

export default PayslipDetail;
