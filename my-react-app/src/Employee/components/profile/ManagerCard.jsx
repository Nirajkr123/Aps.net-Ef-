import React from "react";
import { PhoneOutlined } from "@mui/icons-material";
import { Skeleton } from "@mui/material";

function getInitials(name) {
    return String(name || "")
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function ManagerCard({ name, phone, loading = false }) {
    if (loading) {
        return (
            <section className="emp-prof-card emp-prof-manager" aria-label="Reporting manager">
                <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2 }} />
                <div className="emp-prof-manager-text">
                    <Skeleton variant="text" width={110} height={16} />
                    <Skeleton variant="text" width={150} height={22} />
                </div>
            </section>
        );
    }

    if (!name || String(name).trim() === "") return null;

    const telHref = phone ? `tel:${String(phone).replace(/[^\d+]/g, "")}` : null;

    return (
        <section className="emp-prof-card emp-prof-manager" aria-label="Reporting manager">
            <span className="emp-prof-manager-avatar">{getInitials(name)}</span>

            <div className="emp-prof-manager-text">
                <small>Reporting manager</small>
                <strong>{name}</strong>
            </div>

            {telHref && (
                <a className="emp-prof-call" href={telHref} aria-label="Call manager">
                    <PhoneOutlined />
                </a>
            )}
        </section>
    );
}

export default ManagerCard;
