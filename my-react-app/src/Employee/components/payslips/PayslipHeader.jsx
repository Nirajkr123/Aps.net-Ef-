import React from "react";

function PayslipHeader({ year, years, onYearChange }) {
    return (
        <header className="payslip-header">
            <div className="payslip-header-copy">
                <h1>My Payslips</h1>
                <p>Download and view your monthly salary slips</p>
            </div>
            <label className="payslip-year-control">
                <span className="payslip-sr-only">Payslip year</span>
                <select
                    value={year}
                    onChange={(event) => onYearChange(Number(event.target.value))}
                    aria-label="Payslip year"
                >
                    {years.map((option) => (
                        <option value={option} key={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </label>
        </header>
    );
}

export default PayslipHeader;
