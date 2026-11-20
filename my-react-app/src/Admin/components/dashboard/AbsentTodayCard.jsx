import React from "react";
import { Avatar, Skeleton } from "@mui/material";

import { avatarStyle } from "./ownerDashboardUi";

function AbsentTodayCard({ items = [], loading = false, dayOff = false, limit = 3, onViewAll }) {
    const visible = items.slice(0, limit);
    const emptyText = dayOff ? "Aaj holiday hai." : "Aaj koi absent nahi.";

    return (
        <section className="owner-card owner-absent" aria-label="Absent today">
            <div className="owner-card-head">
                <h2>Absent today</h2>
                <button type="button" className="owner-card-link" onClick={onViewAll}>
                    View all
                </button>
            </div>

            {loading ? (
                <div className="owner-list">
                    {[0, 1, 2].map((index) => (
                        <div className="owner-row" key={index}>
                            <Skeleton variant="circular" width={40} height={40} />
                            <div className="owner-row-copy">
                                <Skeleton variant="text" width="46%" height={18} />
                                <Skeleton variant="text" width="30%" height={15} />
                            </div>
                            <Skeleton variant="rounded" width={68} height={24} sx={{ borderRadius: 999 }} />
                        </div>
                    ))}
                </div>
            ) : visible.length === 0 ? (
                <p className="owner-empty">{emptyText}</p>
            ) : (
                <div className="owner-list">
                    {visible.map((item) => (
                        <div className="owner-row" key={item.id}>
                            <Avatar
                                className="owner-row-avatar"
                                sx={{ background: avatarStyle(item.name) }}
                            >
                                {item.initials}
                            </Avatar>
                            <div className="owner-row-copy">
                                <strong>{item.name}</strong>
                            </div>
                            <span className="owner-badge is-absent">Absent</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default AbsentTodayCard;
