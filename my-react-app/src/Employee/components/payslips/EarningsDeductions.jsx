import React from "react";
import { Skeleton } from "@mui/material";

import { formatCurrency, splitLineItems } from "./payslipUi";

function LineList({ title, items, tone, hidden, loading }) {
    return (
        <section className={`payslip-lines is-${tone}`} aria-label={title}>
            <h3>{title}</h3>
            {loading ? (
                <div className="payslip-line-skeleton">
                    <Skeleton variant="text" height={22} />
                    <Skeleton variant="text" height={22} width="78%" />
                </div>
            ) : items.length > 0 ? (
                <ul>
                    {items.map((item, index) => (
                        <li key={`${item.name}-${index}`}>
                            <span>{item.name}</span>
                            <strong>{formatCurrency(Math.abs(Number(item.amount)), hidden)}</strong>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="payslip-line-empty">—</p>
            )}
        </section>
    );
}

function EarningsDeductions({ items, hidden, loading }) {
    const { earnings, deductions } = splitLineItems(items);

    return (
        <div className="payslip-lines-grid">
            <LineList
                title="Earnings"
                items={earnings}
                tone="earning"
                hidden={hidden}
                loading={loading}
            />
            <LineList
                title="Deductions"
                items={deductions}
                tone="deduction"
                hidden={hidden}
                loading={loading}
            />
        </div>
    );
}

export default EarningsDeductions;
