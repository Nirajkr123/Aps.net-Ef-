import React from "react";
import { Skeleton } from "@mui/material";
import {
    AccessTimeOutlined,
    CheckCircleOutlined,
    EventOutlined,
    ReceiptLongOutlined,
} from "@mui/icons-material";

const ICONS = {
    attendance: <CheckCircleOutlined />,
    leave: <EventOutlined />,
    payslip: <ReceiptLongOutlined />,
};

function TodayList({ items = [], loading = false, onViewAll }) {
    return (
        <section className="emp-home-today">
            <div className="emp-home-section-head">
                <h2>Aaj ka din</h2>
                <button type="button" onClick={onViewAll}>View all</button>
            </div>

            {loading ? (
                <div className="emp-home-today-list">
                    {[0, 1].map((item) => (
                        <Skeleton key={item} variant="rounded" height={62} sx={{ borderRadius: 3 }} />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="emp-home-today-empty">
                    <AccessTimeOutlined sx={{ fontSize: 22 }} />
                    <span>Aaj ke liye abhi koi update nahi hai.</span>
                </div>
            ) : (
                <div className="emp-home-today-list">
                    {items.slice(0, 3).map((item, index) => (
                        <div className={`emp-home-today-item is-${item.type}`} key={`${item.type}-${index}`}>
                            <span className="emp-home-today-icon">{ICONS[item.type] || <CheckCircleOutlined />}</span>
                            <div className="emp-home-today-text">
                                <strong>{item.title}</strong>
                                <span>{item.subtitle || "—"}</span>
                            </div>
                            {item.meta && <em>{item.meta}</em>}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default TodayList;
