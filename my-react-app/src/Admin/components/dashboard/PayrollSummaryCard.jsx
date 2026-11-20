import React from "react";
import { Button, Skeleton } from "@mui/material";

import {
    formatMonthYear,
    formatPayrollAmount,
    RUN_STATUS_META,
} from "./ownerDashboardUi";

function PayrollSummaryCard({ payroll, loading = false, onOpenPayroll, onRunPayroll }) {
    const run = payroll?.run || null;
    const monthLabel = payroll ? formatMonthYear(payroll.month, payroll.year) : "—";
    const statusMeta = run ? RUN_STATUS_META[run.status] || RUN_STATUS_META.DRAFT : null;
    const warnings = Number(run?.warningsCount) || 0;

    return (
        <section className="owner-card owner-payroll" aria-label={`Payroll ${monthLabel}`}>
            <div className="owner-card-head">
                <h2>Payroll · {monthLabel}</h2>
                {!loading && statusMeta && (
                    <span className={`owner-badge ${statusMeta.className}`}>{statusMeta.label}</span>
                )}
            </div>

            {loading ? (
                <div className="owner-payroll-body">
                    <Skeleton variant="text" width="80%" height={20} />
                    <Skeleton variant="text" width="44%" height={36} />
                    <Skeleton variant="rounded" width="100%" height={50} sx={{ borderRadius: 3 }} />
                </div>
            ) : !run ? (
                <div className="owner-payroll-body">
                    <p className="owner-payroll-empty">Is mahine ka payroll abhi nahi chala.</p>
                    <Button type="button" className="owner-payroll-btn" onClick={onRunPayroll}>
                        Run Payroll
                    </Button>
                </div>
            ) : (
                <div className="owner-payroll-body">
                    <div className="owner-stepper" aria-label="Payroll progress">
                        {(payroll.steps || []).map((step, index) => (
                            <React.Fragment key={step.key}>
                                {index > 0 && <span className="owner-stepper-sep" aria-hidden="true">›</span>}
                                <span className={`owner-stepper-step is-${step.state}`}>{step.label}</span>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="owner-payroll-net">
                        <span>Net payout</span>
                        <strong>{formatPayrollAmount(run.netPayout)}</strong>
                    </div>

                    {warnings > 0 && (
                        <p className="owner-payroll-warning">
                            {warnings} payslip{warnings === 1 ? "" : "s"} need attention
                        </p>
                    )}

                    <Button type="button" className="owner-payroll-btn" onClick={onOpenPayroll}>
                        Open Payroll
                    </Button>
                </div>
            )}
        </section>
    );
}

export default PayrollSummaryCard;
