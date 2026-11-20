import React from "react";
import { ChevronRight } from "@mui/icons-material";

function MoreList({ items = [], label = "More options" }) {
    return (
        <section className="emp-prof-more" aria-label={label}>
            {items.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    className={`emp-prof-more-row${item.danger ? " is-danger" : ""}`}
                    onClick={item.onClick}
                >
                    {item.icon && (
                        <span className={`emp-prof-more-icon${item.tone ? ` is-${item.tone}` : ""}`}>
                            {item.icon}
                        </span>
                    )}
                    <span className="emp-prof-more-label">{item.label}</span>
                    {!item.danger && <ChevronRight className="emp-prof-more-chevron" />}
                </button>
            ))}
        </section>
    );
}

export default MoreList;
