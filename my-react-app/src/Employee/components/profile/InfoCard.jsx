import React from "react";

function InfoCard({ title, action, children, className = "", as: Tag = "section" }) {
    return (
        <Tag className={`emp-prof-card${className ? ` ${className}` : ""}`}>
            <div className="emp-prof-card-head">
                <h2>{title}</h2>
                {action}
            </div>
            <div className="emp-prof-fields">{children}</div>
        </Tag>
    );
}

export default InfoCard;
