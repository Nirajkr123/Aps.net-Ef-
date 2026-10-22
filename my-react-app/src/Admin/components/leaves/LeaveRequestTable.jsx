import React from "react";
import {
    Avatar,
    Box,
    Checkbox,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import { CancelRounded, CheckCircleRounded } from "@mui/icons-material";

import {
    INDIGO,
    formatDate,
    formatDateTime,
    statusMeta,
    typeColor,
} from "../../../Employee/components/leaves/leaveShared";

/* Shared bits — table aur mobile card list dono me wahi dikhaate hain, taaki
   desktop/mobile par same data same style me lage. */
export function LeaveStatusChip({ status }) {
    const meta = statusMeta(status);
    return (
        <Chip
            label={status}
            size="small"
            color={meta.color}
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: 12, height: 25 }}
        />
    );
}

export function LeaveTypeChip({ type }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: typeColor(type), flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13 }} noWrap>
                {type}
            </Typography>
        </Box>
    );
}

export function EmployeeCell({ name }) {
    const initials = (name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("");

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.1, minWidth: 0 }}>
            <Avatar
                sx={{
                    width: 32,
                    height: 32,
                    fontSize: 12,
                    fontWeight: 800,
                    /* Ek hi gradient har avatar par — list me row-to-row
                       clean alignment rehti hai (colour randomly badalta
                       nahi, jo data-scan karna mushkil kar deta). */
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    flexShrink: 0,
                }}
            >
                {initials}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13.5 }} noWrap>
                {name}
            </Typography>
        </Box>
    );
}

const HEAD_CELL_SX = {
    fontWeight: 800,
    color: "text.secondary",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    py: 1.4,
    whiteSpace: "nowrap",
};

const BODY_CELL_SX = { py: 1.4 };

/* ---- Desktop table (md+) ------------------------------------------------
   Columns: Employee (avatar + name) | Type | From – To | Days | Reason |
            Applied On | Status | Actions

   Row click drawer kholta hai (details), isiliye cells ke andar
   `stopPropagation` zaroori hai jahan koi button hai. */
function LeaveRequestTable({
    leaves,
    selected,
    onToggleSelect,
    onToggleAll,
    onOpenDetails,
    onApprove,
    onReject,
    allSelected,
    someSelected,
}) {
    const isPending = (l) => l.status === "Pending";

    return (
        <TableContainer className="adm-leave-table-wrap">
            <Table className="adm-leave-table" size="small">
                <TableHead>
                    <TableRow sx={{ bgcolor: "#fafbfe" }}>
                        <TableCell padding="checkbox" sx={HEAD_CELL_SX}>
                            <Tooltip title={allSelected ? "Clear selection" : "Select all pending on this page"}>
                                <Checkbox
                                    size="small"
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={onToggleAll}
                                    inputProps={{ "aria-label": "Select all leave requests" }}
                                />
                            </Tooltip>
                        </TableCell>
                        {["Employee", "Type", "From - To", "Days", "Reason", "Applied On", "Status", "Actions"].map(
                            (head) => (
                                <TableCell key={head} align={head === "Days" ? "center" : "left"} sx={HEAD_CELL_SX}>
                                    {head}
                                </TableCell>
                            )
                        )}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {leaves.map((leave) => {
                        const pending = isPending(leave);
                        const checked = selected.includes(leave.id);

                        return (
                            <TableRow
                                key={leave.id}
                                hover
                                selected={checked}
                                onClick={() => onOpenDetails(leave)}
                                sx={{
                                    cursor: "pointer",
                                    "&:last-child td": { borderBottom: 0 },
                                }}
                            >
                                {/* Checkbox */}
                                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={BODY_CELL_SX}>
                                    <Checkbox
                                        size="small"
                                        checked={checked}
                                        /* Sirf PENDING select ho sakti hai —
                                           approved/rejected par koi action
                                           nahi hai, isliye select karna
                                           bekaar hoga. */
                                        disabled={!pending}
                                        onChange={() => onToggleSelect(leave.id)}
                                        inputProps={{ "aria-label": `Select leave request from ${leave.employeeName}` }}
                                    />
                                </TableCell>

                                {/* Employee */}
                                <TableCell sx={BODY_CELL_SX}>
                                    <EmployeeCell name={leave.employeeName} />
                                </TableCell>

                                {/* Type */}
                                <TableCell sx={BODY_CELL_SX}>
                                    <LeaveTypeChip type={leave.type} />
                                </TableCell>

                                {/* From – To */}
                                <TableCell sx={{ ...BODY_CELL_SX, whiteSpace: "nowrap", color: "text.primary", fontSize: 13 }}>
                                    {formatDate(leave.from)}
                                    <Box component="span" sx={{ color: "text.disabled", mx: 0.5 }}>
                                        –
                                    </Box>
                                    {formatDate(leave.to)}
                                </TableCell>

                                {/* Days */}
                                <TableCell align="center" sx={BODY_CELL_SX}>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 800, color: INDIGO, fontVariantNumeric: "tabular-nums" }}
                                    >
                                        {leave.days}
                                    </Typography>
                                </TableCell>

                                {/* Reason — truncate + tooltip */}
                                <TableCell sx={{ ...BODY_CELL_SX, maxWidth: 220 }}>
                                    <Tooltip title={leave.reason || ""} placement="top" arrow>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: "text.secondary",
                                                display: "block",
                                                maxWidth: 200,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {leave.reason || "—"}
                                        </Typography>
                                    </Tooltip>
                                </TableCell>

                                {/* Applied on */}
                                <TableCell sx={{ ...BODY_CELL_SX, whiteSpace: "nowrap", color: "text.secondary", fontSize: 12.5 }}>
                                    {formatDateTime(leave.appliedOn)}
                                </TableCell>

                                {/* Status */}
                                <TableCell sx={BODY_CELL_SX}>
                                    <LeaveStatusChip status={leave.status} />
                                </TableCell>

                                {/* Actions */}
                                <TableCell sx={BODY_CELL_SX} onClick={(e) => e.stopPropagation()}>
                                    {pending ? (
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            <Tooltip title="Reject">
                                                <Box
                                                    component="button"
                                                    type="button"
                                                    onClick={() => onReject(leave)}
                                                    aria-label={`Reject ${leave.employeeName}'s ${leave.type} leave`}
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        borderRadius: 2,
                                                        border: "1px solid #fecaca",
                                                        bgcolor: "#fff",
                                                        color: "#dc2626",
                                                        cursor: "pointer",
                                                        transition: "background-color .15s ease",
                                                        "&:hover": { bgcolor: "#fef2f2" },
                                                    }}
                                                >
                                                    <CancelRounded sx={{ fontSize: 17 }} />
                                                </Box>
                                            </Tooltip>
                                            <Tooltip title="Approve">
                                                <Box
                                                    component="button"
                                                    type="button"
                                                    onClick={() => onApprove(leave)}
                                                    aria-label={`Approve ${leave.employeeName}'s ${leave.type} leave`}
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        borderRadius: 2,
                                                        border: "1px solid #a7f3d0",
                                                        bgcolor: "#fff",
                                                        color: "#059669",
                                                        cursor: "pointer",
                                                        transition: "background-color .15s ease",
                                                        "&:hover": { bgcolor: "#ecfdf5" },
                                                    }}
                                                >
                                                    <CheckCircleRounded sx={{ fontSize: 17 }} />
                                                </Box>
                                            </Tooltip>
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" color="text.disabled">
                                            —
                                        </Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default LeaveRequestTable;
