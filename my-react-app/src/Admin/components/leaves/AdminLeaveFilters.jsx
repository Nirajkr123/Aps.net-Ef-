import React from "react";
import {
    Box,
    Chip,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { CloseRounded, FilterAltOffOutlined, SearchRounded } from "@mui/icons-material";

import {
    INDIGO,
    INDIGO_DARK,
    LEAVE_TYPES,
    todayISO,
} from "../../../Employee/components/leaves/leaveShared";

/* Admin list ke filters — 4 cheezein ek hi row me:
   1. status chips  (Pending default)
   2. employee name search
   3. leave type select
   4. applied-date range (from / to)

   Chhoti screen par sab apni line par gir jaate hain (wrap), koi horizontal
   scroll nahi — filters chhote hote hain, list lambi. */
const STATUS_FILTERS = ["Pending", "Approved", "Rejected", "Cancelled", "All"];

function AdminLeaveFilters({
    status,
    onStatusChange,
    counts,
    search,
    onSearchChange,
    type,
    onTypeChange,
    from,
    to,
    onRangeChange,
}) {
    const hasExtraFilters = !!(search || type || from || to);

    const clearAll = () => {
        onSearchChange("");
        onTypeChange("");
        onRangeChange("", "");
    };

    return (
        <Box
            sx={{
                px: { xs: 2, md: 2.5 },
                py: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1.75,
            }}
        >
            {/* ---- Row 1: status chips + clear-all ---- */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Box
                    className="adm-leave-filter-scroll"
                    sx={{
                        display: "flex",
                        gap: 0.75,
                        flexWrap: "wrap",
                        flex: 1,
                        minWidth: 0,
                    }}
                >
                    {STATUS_FILTERS.map((s) => {
                        const selected = status === s;
                        return (
                            <Chip
                                key={s}
                                label={`${s} ${counts[s] ?? 0}`}
                                size="small"
                                onClick={() => onStatusChange(s)}
                                aria-pressed={selected}
                                variant={selected ? "filled" : "outlined"}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: 12.5,
                                    height: { xs: 38, sm: 32 },
                                    cursor: "pointer",
                                    borderColor: "#e3e6f0",
                                    color: "text.secondary",
                                    bgcolor: selected ? INDIGO : "transparent",
                                    "&:hover": { bgcolor: selected ? INDIGO_DARK : "#f4f5fb" },
                                }}
                            />
                        );
                    })}
                </Box>

                {hasExtraFilters && (
                    <Tooltip title="Clear search, type and date filters">
                        <Chip
                            label="Clear filters"
                            size="small"
                            onClick={clearAll}
                            icon={<FilterAltOffOutlined sx={{ fontSize: "15px !important" }} />}
                            sx={{
                                fontWeight: 700,
                                fontSize: 12,
                                height: 32,
                                cursor: "pointer",
                                bgcolor: "#fef2f2",
                                color: "#dc2626",
                                "&:hover": { bgcolor: "#fee2e2" },
                            }}
                        />
                    </Tooltip>
                )}
            </Box>

            {/* ---- Row 2: search + type + date range ---- */}
            <Box
                sx={{
                    display: "grid",
                    /* Mobile 1 column, sm 2, md+ search/type/date 3 columns. */
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "minmax(220px, 1.4fr) minmax(150px, 1fr) auto" },
                    gap: 1.25,
                    alignItems: "center",
                }}
            >
                {/* Employee name search */}
                <TextField
                    size="small"
                    placeholder="Search by employee name…"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <SearchRounded sx={{ fontSize: 18, color: "text.disabled", mr: 0.75 }} />
                            ),
                            endAdornment: search ? (
                                <IconButton
                                    size="small"
                                    onClick={() => onSearchChange("")}
                                    aria-label="Clear search"
                                >
                                    <CloseRounded sx={{ fontSize: 16 }} />
                                </IconButton>
                            ) : null,
                            sx: { fontSize: 13.5 },
                        },
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fcfdff" } }}
                />

                {/* Leave type */}
                <FormControl size="small" sx={{ minWidth: 0 }}>
                    <InputLabel id="admin-leave-type-label" sx={{ fontSize: 13.5, fontWeight: 600 }}>
                        Leave type
                    </InputLabel>
                    <Select
                        labelId="admin-leave-type-label"
                        label="Leave type"
                        value={type}
                        onChange={(e) => onTypeChange(e.target.value)}
                        sx={{ fontSize: 13.5, borderRadius: 2.5, bgcolor: "#fcfdff" }}
                    >
                        <MenuItem value="" sx={{ fontSize: 13.5, fontWeight: 600 }}>
                            All types
                        </MenuItem>
                        {LEAVE_TYPES.map((t) => (
                            <MenuItem key={t} value={t} sx={{ fontSize: 13.5, fontWeight: 600 }}>
                                {t}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Date range — dono fields ek flex row me, kabhi overflow nahi */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <TextField
                        label="From"
                        type="date"
                        size="small"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => onRangeChange(e.target.value, to)}
                        slotProps={{
                            inputLabel: { shrink: true },
                            htmlInput: { max: to || undefined },
                        }}
                        sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 13 }, "& .MuiInputLabel-root": { fontSize: 13 } }}
                    />
                    <Typography variant="body2" color="text.disabled" sx={{ flexShrink: 0 }}>
                        –
                    </Typography>
                    <TextField
                        label="To"
                        type="date"
                        size="small"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => onRangeChange(from, e.target.value)}
                        slotProps={{
                            inputLabel: { shrink: true },
                            htmlInput: { min: from || todayISO() },
                        }}
                        sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 13 }, "& .MuiInputLabel-root": { fontSize: 13 } }}
                    />
                </Box>
            </Box>
        </Box>
    );
}

export default AdminLeaveFilters;
