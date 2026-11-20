import React from "react";
import { Avatar, Skeleton } from "@mui/material";

import { avatarStyle } from "./ownerDashboardUi";

function PendingRequestsCard({ items = [], loading = false, limit = 4, onViewAll, onReview }) {
    const visible = items.slice(0, limit);

    return (
        <section className="owner-card owner-pending" aria-label="Pending requests">
            <div className="owner-card-head">
                <h2>Pending requests</h2>
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
                                <Skeleton variant="text" width="42%" height={18} />
                                <Skeleton variant="text" width="62%" height={15} />
                            </div>
                            <Skeleton variant="rounded" width={84} height={44} sx={{ borderRadius: 2.5 }} />
                        </div>
                    ))}
                </div>
            ) : visible.length === 0 ? (
                <p className="owner-empty">Koi pending request nahi.</p>
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
                                <span>{item.subtitle}</span>
                            </div>
                            <button
                                type="button"
                                className="owner-review-btn"
                                onClick={() => onReview(item)}
                                aria-label={`Review request from ${item.name}`}
                            >
                                Review
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default PendingRequestsCard;
