import React from "react";

import "./adminUi.css";

function FilterPills({ options = [], value, onChange, ariaLabel = "Filter" }) {
    return (
        <div className="admin-pills" role="group" aria-label={ariaLabel}>
            {options.map((option) => {
                const active = option.key === value;

                return (
                    <button
                        key={option.key}
                        type="button"
                        className={`admin-pill${active ? " is-active" : ""}`}
                        onClick={() => onChange?.(option.key)}
                        aria-pressed={active}
                    >
                        <span>{option.label}</span>
                        {option.count != null && <span className="admin-pill-count">{option.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

export default FilterPills;
