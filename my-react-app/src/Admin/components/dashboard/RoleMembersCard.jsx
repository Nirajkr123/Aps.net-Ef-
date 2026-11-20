import React from "react";
import { Skeleton } from "@mui/material";

function RoleMembersCard({ members = [], loading = false, canManage = false, onManage }) {
    return (
        <section className="owner-card owner-members" aria-label="Members by role">
            <div className="owner-card-head">
                <h2>Members by role</h2>
                {canManage && (
                    <button type="button" className="owner-card-link" onClick={onManage}>
                        Manage
                    </button>
                )}
            </div>

            {loading ? (
                <div className="owner-members-list">
                    {[0, 1, 2].map((index) => (
                        <div className="owner-member-row" key={index}>
                            <Skeleton variant="circular" width={10} height={10} />
                            <Skeleton variant="text" width="44%" height={18} />
                            <Skeleton variant="text" width={28} height={18} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="owner-members-list">
                    {members.map((member) => (
                        <div className="owner-member-row" key={member.key}>
                            <span className="owner-member-dot" style={{ background: member.color }} />
                            <span className="owner-member-label">{member.label}</span>
                            <strong>{member.count}</strong>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default RoleMembersCard;
