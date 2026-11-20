import React from "react";

import { getPayslipStatus } from "./payslipUi";

function PayslipStatusBadge({ payslip, size = "regular" }) {
    const meta = getPayslipStatus(payslip);

    return (
        <span className={`payslip-badge is-${meta.key} is-${size}`}>
            {meta.label}
        </span>
    );
}

export default PayslipStatusBadge;
