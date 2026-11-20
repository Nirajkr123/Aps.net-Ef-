import React from "react";
import { Card, CardContent } from "@mui/material";

import PayslipDetail from "./PayslipDetail";

function LatestPayslipCard(props) {
    return (
        <Card className="payslip-latest-card" elevation={0}>
            <CardContent className="payslip-latest-content">
                <PayslipDetail {...props} />
            </CardContent>
        </Card>
    );
}

export default LatestPayslipCard;
