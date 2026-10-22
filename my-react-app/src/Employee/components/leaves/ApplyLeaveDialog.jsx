import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    LinearProgress,
    MenuItem,
    Select,
    TextField,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { CloseRounded, EventOutlined, InfoOutlined } from "@mui/icons-material";

import { validateLeaveRequest, REASON_MIN_LENGTH } from "../../../services/leaveService";
import {
    INDIGO,
    INDIGO_DARK,
    LEAVE_TYPES,
    LEAVE_TYPE_META,
    countLeaveDays,
    remainingOf,
    todayISO,
    typeColor,
    typeOptionLabel,
} from "./leaveShared";

const EMPTY_FORM = { type: "", from: "", to: "", reason: "" };

/* Apply-for-leave form. Mobile par poora screen, desktop par centre modal.

   Total days dates se khud calculate hota hai (sab din gin-te hain, weekend
   bhi) — user se number nahi maangta, warna do fields alag-alag ho jaate
   hain. Server bhi wahi formula use karta hai, isiliye dono ka number
   hamesha match karta hai.

   `balance`   — current employee ka balance (remaining dikhane + validate
                 karne ke liye)
   `leaves`    — current employee ki existing leaves (overlap check)
   `existing`  — false ho to dialog dusra employee (admin) ki behalf par
                 open hua hai; tab employee ka apna history nahi milta,
                 isliye overlap check skip hota hai. */
function ApplyLeaveDialog({ open, onClose, onSubmit, submitting, balance, leaves = [], existing = true }) {
    const fullScreen = useMediaQuery((theme) => theme.breakpoints.down("sm"));
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});

    /* Har baar dialog khulte hi clean slate — pichli baar ka half-filled
       form ya uski error messages na dikhein. */
    useEffect(() => {
        if (open) {
            setForm(EMPTY_FORM);
            setErrors({});
        }
    }, [open]);

    const totalDays = useMemo(() => countLeaveDays(form.from, form.to), [form.from, form.to]);

    /* Chosen type ke baaki din — select me "(12 left)" ke saath, aur form
       ke niche bhi, taaki user ko pata ho request kitna kar sakta hai. */
    const remaining = form.type ? remainingOf(balance, form.type) : null;

    const setField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        /* Field change hone par uska purana error hata do — warna user
           sahi value bhar raha hota hai par message red pada rehta. */
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    /* To date ko from ke aage kheenchte hi `min` badal jata hai, isliye
       browser calendar khud hi peeche ke dates block kar deta hai. */
    useEffect(() => {
        if (!form.from) return;
        setForm((prev) => (prev.to && prev.to < prev.from ? { ...prev, to: "" } : prev));
    }, [form.from]);

    const validate = () => {
        /* Saare rules service me hain (validation + server ke rules ek hi
           jagah), to form aur API dono wahi message dete hain. */
        const result = validateLeaveRequest(form, {
            balance,
            existingLeaves: existing ? leaves : [],
        });

        if (result.ok) {
            setErrors({});
            return true;
        }

        /* Type/dates/reason ke alag-alag fields pe lagao, taaki helper
           text usi field ke niche dikhe. `days` aur `clash` dono `from`
           ya `days` par dikhate hain. */
        const field = result.field === "days" ? "days" : result.field;
        setErrors({ [field]: result.message });
        return false;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        onSubmit({ type: form.type, from: form.from, to: form.to, days: totalDays, reason: form.reason.trim() });
    };

    const labelSx = {
        fontWeight: 700,
        fontSize: 13.5,
        "&.Mui-focused": { fontWeight: 700 },
    };

    const reasonLen = form.reason.trim().length;
    const reasonShort = form.reason.length > 0 && reasonLen < REASON_MIN_LENGTH;

    return (
        <Dialog
            open={open}
            onClose={submitting ? undefined : onClose}
            fullScreen={fullScreen}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: { borderRadius: 4, m: { xs: 0, sm: 2 } } }}
        >
            <DialogTitle
                sx={{
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: { xs: 2, sm: 3 },
                    pt: { xs: 2, sm: 2.5 },
                    pb: 1,
                }}
            >
                <Box
                    sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "#eef0ff",
                        color: INDIGO,
                    }}
                >
                    <EventOutlined sx={{ fontSize: 19 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, flex: 1, minWidth: 0 }}>
                    Apply for Leave
                </Typography>
                <IconButton onClick={onClose} size="small" aria-label="Close" disabled={submitting} sx={{ color: "text.secondary" }}>
                    <CloseRounded fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
                    {/* ---- Leave type ---- */}
                    <FormControl fullWidth error={!!errors.type}>
                        <InputLabel id="leave-type-label" sx={labelSx}>
                            Leave Type
                        </InputLabel>
                        <Select
                            labelId="leave-type-label"
                            label="Leave Type"
                            value={form.type}
                            onChange={(e) => setField("type", e.target.value)}
                            sx={{ fontWeight: 600, "& .MuiSelect-select": { py: 1.25 } }}
                        >
                            {LEAVE_TYPES.map((value) => {
                                const meta = LEAVE_TYPE_META[value];
                                const left = remainingOf(balance, value);
                                return (
                                    <MenuItem key={value} value={value} sx={{ gap: 1, fontWeight: 600 }}>
                                        <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0 }} />
                                        {/* Type + baki din — dropdown me hi
                                            dikhta hai, taaki user bina
                                            date bhare pata kar le ki uske
                                            paas kitna left hai. */}
                                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flex: 1 }}>
                                            <span>{meta.label}</span>
                                            <Typography
                                                variant="caption"
                                                sx={{ fontWeight: 700, color: left > 0 ? typeColor(value) : "#dc2626" }}
                                            >
                                                {typeOptionLabel(value, balance)}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Select>
                        {errors.type ? (
                            <FormHelperText sx={{ mx: 1.75 }}>{errors.type}</FormHelperText>
                        ) : (
                            remaining !== null && (
                                <FormHelperText sx={{ mx: 1.75 }}>
                                    {remaining} {remaining === 1 ? "day" : "days"} of {form.type} left · balance is deducted only after approval
                                </FormHelperText>
                            )
                        )}
                    </FormControl>

                    {/* ---- From / To ---- */}
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
                        <TextField
                            label="From Date"
                            type="date"
                            fullWidth
                            value={form.from}
                            onChange={(e) => setField("from", e.target.value)}
                            error={!!errors.from}
                            helperText={errors.from || "Cannot be a past date"}
                            slotProps={{
                                inputLabel: { shrink: true },
                                htmlInput: { min: todayISO() },
                            }}
                        />
                        <TextField
                            label="To Date"
                            type="date"
                            fullWidth
                            value={form.to}
                            onChange={(e) => setField("to", e.target.value)}
                            error={!!errors.to}
                            helperText={errors.to || "Must be on or after from date"}
                            slotProps={{
                                inputLabel: { shrink: true },
                                htmlInput: { min: form.from || todayISO() },
                            }}
                        />
                    </Box>

                    {/* ---- Auto-calculated days ---- */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1.5,
                            px: 1.75,
                            py: 1.4,
                            borderRadius: 2.5,
                            bgcolor: errors.days ? "#fef2f2" : "#f7f8fc",
                            border: "1px solid",
                            borderColor: errors.days ? "#fecaca" : "#eef0f7",
                        }}
                    >
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Total Days
                            <Box component="span" sx={{ display: "block", fontSize: 11, color: "text.disabled" }}>
                                Weekends excluded
                            </Box>
                        </Typography>
                        <Typography
                            sx={{ fontWeight: 800, color: totalDays > 0 ? INDIGO : "text.disabled", fontSize: 18, flexShrink: 0 }}
                        >
                            {totalDays} {totalDays === 1 ? "day" : "days"}
                        </Typography>
                    </Box>

                    {/* Balance warning — days available se zyada ho to yahin
                        turant (submit se pehle) dikha dete hain. */}
                    {errors.days && (
                        <Alert severity="error" sx={{ borderRadius: 2.5, py: 0.5, "& .MuiAlert-message": { fontSize: 12.5 } }}>
                            {errors.days}
                        </Alert>
                    )}

                    {/* Chosen type ke against remaining ka mini bar — form
                        bharte waqt hi pata chal jata hai ki kitna bacha. */}
                    {form.type && totalDays > 0 && remaining !== null && !errors.days && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, mt: -1 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: 11.5 }}>
                                    {totalDays} of {remaining} {form.type} days
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: typeColor(form.type), fontSize: 11.5 }}>
                                    {Math.max(0, remaining - totalDays)} left after this
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(100, remaining > 0 ? (totalDays / (totalDays + remaining)) * 100 : 100)}
                                sx={{
                                    height: 5,
                                    borderRadius: 3,
                                    bgcolor: `${typeColor(form.type)}1a`,
                                    "& .MuiLinearProgress-bar": { borderRadius: 3, bgcolor: typeColor(form.type) },
                                }}
                            />
                        </Box>
                    )}

                    {/* ---- Reason ---- */}
                    <TextField
                        label="Reason"
                        placeholder="Why are you applying for this leave?"
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={6}
                        value={form.reason}
                        onChange={(e) => setField("reason", e.target.value)}
                        error={!!errors.reason || reasonShort}
                        helperText={
                            errors.reason ||
                            `Minimum ${REASON_MIN_LENGTH} characters — a short reason helps your manager approve faster.`
                        }
                    />

                    {/* Character counter — reason box ke niche, halka. */}
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: -2.5, mr: 0.5 }}>
                        <Typography
                            variant="caption"
                            sx={{ fontWeight: 700, fontSize: 11, color: reasonShort ? "#dc2626" : "text.disabled" }}
                        >
                            {reasonLen}/{REASON_MIN_LENGTH} min
                        </Typography>
                    </Box>

                    {existing && (
                        <Alert
                            severity="info"
                            icon={<InfoOutlined fontSize="inherit" />}
                            sx={{ borderRadius: 2.5, py: 0.5, "& .MuiAlert-message": { fontSize: 12 } }}
                        >
                            Dates must not overlap with your existing pending or approved leave. Your balance is
                            deducted only after approval.
                        </Alert>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, pt: 1, gap: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={submitting}
                    sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                        minHeight: 44,
                        flex: { xs: 1, sm: "none" },
                    }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting}
                    sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        minHeight: 44,
                        flex: { xs: 1, sm: "none" },
                        px: 3,
                        borderRadius: 2.5,
                        bgcolor: INDIGO,
                        boxShadow: "0 8px 20px -8px rgba(79,70,229,0.6)",
                        "&:hover": { bgcolor: INDIGO_DARK },
                    }}
                >
                    {submitting ? "Submitting…" : "Submit"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default ApplyLeaveDialog;
