import React from "react";

const CARDS = [
    { key: "All", label: "All", tone: "all" },
    { key: "Pending", label: "Pending", tone: "pending" },
    { key: "Approved", label: "Approved", tone: "approved" },
    { key: "Rejected", label: "Rejected", tone: "rejected" },
];

function StatusSummaryCards({ value, counts, onChange }) {
    return (
        <div
            className="emp-leave-status-cards"
            role="group"
            aria-label="Filter leave requests by status"
        >
            {CARDS.map((card) => {
                const active = value === card.key;
                return (
                    <button
                        key={card.key}
                        type="button"
                        className={`emp-leave-status-card is-${card.tone}${active ? " is-active" : ""}`}
                        aria-pressed={active}
                        onClick={() => onChange(card.key)}
                    >
                        <strong>{counts[card.key] || 0}</strong>
                        <span>{card.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

export default StatusSummaryCards;
