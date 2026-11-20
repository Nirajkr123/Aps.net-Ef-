import React from "react";
import { Button } from "@mui/material";
import {
    PublishRounded,
    RefreshRounded,
} from "@mui/icons-material";

import { formatMonthYear, getRunStatusLabel } from "./payrollUi";

const pad = (value) => String(value).padStart(2, "0");

function PayrollHeader({
    month,
    year,
    run,
    onMonthChange,
    onRecalculate,
    onPublish,
    canRecalculate,
    canPublish,
    busy,
}) {
    const statusLabel = getRunStatusLabel(run?.status);
    const publishLabel = run?.status === "APPROVED" ? "Publish" : "Approve & Publish";

    return (
        <header className="payroll-header">
            <div className="payroll-header-copy">
                <h1>Payroll</h1>
                <p>
                    {formatMonthYear(month, year)} · {statusLabel}
                </p>
            </div>

            <div className="payroll-header-actions">
                <label className="payroll-month-control">
                    <span className="payroll-sr-only">Payroll month</span>
                    <input
                        type="month"
                        value={`${year}-${pad(month)}`}
                        onChange={(event) => {
                            const [nextYear, nextMonth] = event.target.value.split("-").map(Number);
                            if (nextYear && nextMonth) onMonthChange(nextMonth, nextYear);
                        }}
                        aria-label="Payroll month"
                    />
                </label>

                <Button
                    type="button"
                    variant="outlined"
                    className="payroll-secondary-btn"
                    startIcon={<RefreshRounded />}
                    onClick={onRecalculate}
                    disabled={!canRecalculate || !!busy}
                >
                    Recalculate
                </Button>

                <Button
                    type="button"
                    variant="contained"
                    className="payroll-primary-btn"
                    startIcon={<PublishRounded />}
                    onClick={onPublish}
                    disabled={!canPublish || !!busy}
                >
                    {busy === "publish" ? "Publishing..." : publishLabel}
                </Button>
            </div>
        </header>
    );
}

export default PayrollHeader;
