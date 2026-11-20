import React from "react";
import { ChevronRightRounded, EventOutlined, PaymentsOutlined } from "@mui/icons-material";

function QuickActions({ onApplyLeave, onViewPayslips }) {
    return (
        <section className="emp-home-quick">
            <div className="emp-home-card-head">
                <h2>Quick actions</h2>
            </div>

            <div className="emp-home-quick-grid">
                <button type="button" className="emp-home-quick-action" onClick={onApplyLeave}>
                    <span className="emp-home-quick-icon is-leave">
                        <EventOutlined />
                    </span>
                    <span className="emp-home-quick-text">
                        <strong>Apply Leave</strong>
                        <small>Request time off</small>
                    </span>
                    <ChevronRightRounded className="emp-home-quick-arrow" />
                </button>

                <button type="button" className="emp-home-quick-action" onClick={onViewPayslips}>
                    <span className="emp-home-quick-icon is-pay">
                        <PaymentsOutlined />
                    </span>
                    <span className="emp-home-quick-text">
                        <strong>View Payslips</strong>
                        <small>Open salary history</small>
                    </span>
                    <ChevronRightRounded className="emp-home-quick-arrow" />
                </button>
            </div>
        </section>
    );
}

export default QuickActions;
