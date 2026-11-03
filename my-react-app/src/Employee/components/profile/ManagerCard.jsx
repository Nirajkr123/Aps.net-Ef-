import React from "react";
import { PersonOutlined, PhoneOutlined } from "@mui/icons-material";

function ManagerCard({ name, phone }) {
    if (!name || !phone) return null;

    const telHref = `tel:${String(phone).replace(/[^\d+]/g, "")}`;

    return (
        <section className="emp-profile-card emp-profile-manager" aria-label="Reporting manager">
            <span className="emp-profile-manager-icon">
                <PersonOutlined />
            </span>

            <div className="emp-profile-manager-text">
                <strong>{name}</strong>
                <small>Reporting manager</small>
            </div>

            <a className="emp-profile-call" href={telHref} aria-label={`Call ${name}`}>
                <PhoneOutlined />
            </a>
        </section>
    );
}

export default ManagerCard;
