import React from "react";
import { Card, Skeleton } from "@mui/material";
import LeaveTypeChip from "./LeaveTypeChip";
import { toBalanceView } from "./leaveShared";

function BalanceSkeleton() {
    return (
        <div className="emp-leave-balance-skeleton">
            <div className="emp-leave-balance-skeleton-top">
                <Skeleton variant="text" width={92} height={54} />
                <Skeleton variant="text" width={104} height={22} />
            </div>
            <Skeleton variant="rounded" height={7} />
            <div className="emp-leave-type-grid">
                {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} variant="rounded" height={82} />
                ))}
            </div>
        </div>
    );
}

function BalanceCard({ balance, loading }) {
    const view = toBalanceView(balance);
    const usedPct = view.total > 0 ? Math.min(100, (view.used / view.total) * 100) : 0;

    return (
        <Card component="section" elevation={0} className="emp-leave-balance" aria-label="Leave balance">
            {loading ? (
                <BalanceSkeleton />
            ) : (
                <>
                    <div className="emp-leave-balance-top">
                        <div className="emp-leave-balance-left">
                            <strong>{view.remaining}</strong>
                            <span>days left</span>
                        </div>
                        <div className="emp-leave-balance-used">
                            <strong>{view.used}</strong>
                            <span>of {view.total} used</span>
                        </div>
                    </div>

                    <div
                        className="emp-leave-progress"
                        role="progressbar"
                        aria-label={`${view.used} of ${view.total} leave days used`}
                        aria-valuemin={0}
                        aria-valuemax={view.total}
                        aria-valuenow={view.used}
                    >
                        <span style={{ width: `${usedPct}%` }} />
                    </div>

                    {view.breakdown.length > 0 ? (
                        <div className="emp-leave-type-grid">
                            {view.breakdown.map((item) => (
                                <LeaveTypeChip key={item.type} item={item} />
                            ))}
                        </div>
                    ) : (
                        <p className="emp-leave-empty-text">Leave balance available nahi hai.</p>
                    )}
                </>
            )}
        </Card>
    );
}

export default BalanceCard;
