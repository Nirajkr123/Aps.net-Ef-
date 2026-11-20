import React from "react";
import { Card } from "@mui/material";

function InfoSection({ title, children }) {
    return (
        <section className="emp-pi-section">
            <h2>{title}</h2>
            <Card className="emp-pi-card" elevation={0}>
                {children}
            </Card>
        </section>
    );
}

export default InfoSection;
