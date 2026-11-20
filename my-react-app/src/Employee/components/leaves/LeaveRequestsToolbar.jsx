import React from "react";
import { InputAdornment, MenuItem, TextField } from "@mui/material";
import { SearchOutlined } from "@mui/icons-material";

function LeaveRequestsToolbar({
    years,
    year,
    onYearChange,
    search,
    onSearchChange,
}) {
    return (
        <div className="emp-leave-toolbar">
            <TextField
                select
                size="small"
                label="Year"
                value={year}
                onChange={(event) => onYearChange(event.target.value)}
                className="emp-leave-year-select"
                slotProps={{ htmlInput: { "aria-label": "Filter leave requests by year" } }}
            >
                {years.map((option) => (
                    <MenuItem key={option} value={option}>
                        {option}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                size="small"
                placeholder="Search by leave type or date"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="emp-leave-search"
                slotProps={{
                    htmlInput: { "aria-label": "Search leave requests by type or date" },
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchOutlined />
                            </InputAdornment>
                        ),
                    },
                }}
            />
        </div>
    );
}

export default LeaveRequestsToolbar;
