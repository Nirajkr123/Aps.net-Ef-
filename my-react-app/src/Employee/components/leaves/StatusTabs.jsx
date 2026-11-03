import React from "react";

const TABS = ["All", "Pending", "Approved", "Rejected"];

function StatusTabs({ value, onChange }) {
    return (
        <div className="emp-leave-tabs" role="tablist" aria-label="Filter leave requests">
            {TABS.map((tab) => {
                const active = value === tab;
                return (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`emp-leave-tab${active ? " is-active" : ""}`}
                        onClick={() => onChange(tab)}
                    >
                        {tab}
                    </button>
                );
            })}
        </div>
    );
}

export default StatusTabs;
