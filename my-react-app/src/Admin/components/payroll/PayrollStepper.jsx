import React from "react";
import {
    CheckRounded,
    FactCheckOutlined,
    PlaylistAddCheckOutlined,
    PublishedWithChangesOutlined,
    CalculateOutlined,
} from "@mui/icons-material";

const STEP_ICONS = {
    calculate: CalculateOutlined,
    review: FactCheckOutlined,
    approve: PlaylistAddCheckOutlined,
    publish: PublishedWithChangesOutlined,
};

function PayrollStepper({ steps }) {
    return (
        <section className="payroll-stepper" aria-label="Payroll progress">
            {steps.map((step, index) => {
                const Icon = STEP_ICONS[step.key] || CalculateOutlined;

                return (
                    <React.Fragment key={step.key}>
                        <div className={`payroll-step is-${step.state}`}>
                            <span className="payroll-step-icon">
                                {step.state === "done" ? <CheckRounded /> : <Icon />}
                            </span>
                            <span className="payroll-step-label">{step.label}</span>
                        </div>
                        {index < steps.length - 1 && (
                            <span
                                className={`payroll-step-line${step.state === "done" ? " is-done" : ""}`}
                                aria-hidden="true"
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </section>
    );
}

export default PayrollStepper;
