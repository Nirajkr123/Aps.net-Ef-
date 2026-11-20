import React from "react";
import { Skeleton } from "@mui/material";
import {
    AccountBalanceWalletOutlined,
    PeopleAltOutlined,
    TrendingDownOutlined,
    TrendingUpOutlined,
} from "@mui/icons-material";

import { formatCurrency } from "./payrollUi";

function SummaryCards({ run, loading }) {
    const cards = [
        {
            key: "employees",
            label: "Employees",
            value: Number(run?.employeeCount) || 0,
            tone: "neutral",
            icon: <PeopleAltOutlined />,
        },
        {
            key: "gross",
            label: "Total gross",
            value: formatCurrency(run?.totalGross || 0),
            tone: "green",
            icon: <TrendingUpOutlined />,
        },
        {
            key: "deductions",
            label: "Total deductions",
            value: formatCurrency(run?.totalDeductions || 0),
            tone: "red",
            icon: <TrendingDownOutlined />,
        },
        {
            key: "net",
            label: "Net payout",
            value: formatCurrency(run?.netPayout || 0),
            tone: "purple",
            icon: <AccountBalanceWalletOutlined />,
        },
    ];

    return (
        <section className="payroll-summary-grid" aria-label="Payroll summary">
            {cards.map((card) => (
                <article className={`payroll-summary-card is-${card.tone}`} key={card.key}>
                    <span className="payroll-summary-icon">{card.icon}</span>
                    <span className="payroll-summary-label">{card.label}</span>
                    {loading ? (
                        <Skeleton variant="text" width="68%" height={38} />
                    ) : (
                        <strong>{card.value}</strong>
                    )}
                </article>
            ))}
        </section>
    );
}

export default SummaryCards;
