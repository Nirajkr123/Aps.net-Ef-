import React from "react";
import { Button, CircularProgress } from "@mui/material";
import { AddRounded, ReceiptLongOutlined } from "@mui/icons-material";

function EmptyRunState({ monthLabel, onCreate, creating }) {
    return (
        <section className="payroll-empty-state">
            <span className="payroll-empty-icon">
                <ReceiptLongOutlined />
            </span>
            <h2>No payroll run for {monthLabel}</h2>
            <p>
                Payroll run banaiye, salary calculate kijiye, LOP aur warnings review karke
                payslips publish kijiye.
            </p>
            <Button
                type="button"
                variant="contained"
                className="payroll-primary-btn"
                startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <AddRounded />}
                onClick={onCreate}
                disabled={!!creating}
            >
                {creating ? "Creating..." : `Create ${monthLabel} Payroll`}
            </Button>
        </section>
    );
}

export default EmptyRunState;
