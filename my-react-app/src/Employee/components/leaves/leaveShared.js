/* =========================================================================
   LEAVE PAGE — shared tokens & helpers
   -------------------------------------------------------------------------
   Har component apna card/colour dobara na likhe, isliye page ki styling
   language (card surface, leave-type colours, status colours) aur date/
   day-count helpers yahan ek jagah hain.

   Date/business-day helpers `leaveService.js` se aate hain (data layer) aur
   yahan se re-export hote hain — components sirf yeh file import karein.
   ========================================================================= */

import { LEAVE_TYPE_META, LEAVE_TYPES, LEAVE_QUOTAS } from "../../../services/leaveService";

export { LEAVE_TYPE_META, LEAVE_TYPES, LEAVE_QUOTAS };

/* --- Card surface -------------------------------------------------------
   White card, 16px radius, elevation 0 + soft indigo-tinted shadow.
   (`borderRadius: 4` MUI ka 4 * 4px = 16px hai.) */

export const CARD_SX = {
    elevation: 0,
    borderRadius: 4,
    boxShadow: "0 2px 12px rgba(80,70,229,0.06)",
    border: "1px solid #eef0f7",
    bgcolor: "#ffffff",
};

export const INDIGO = "#4f46e5";
export const INDIGO_DARK = "#4338ca";

/* --- Leave type colours -------------------------------------------------
   Dashboard wale `LeaveBalanceCard` se same palette, taaki type ka colour
   page par har jagah (table, card, chip) ek jaisa dikhe. */

export const LEAVE_TYPE_COLORS = {
    Casual: "#4f46e5",
    Sick: "#dc2626",
    Earned: "#059669",
    Personal: "#d97706",
};

export const typeColor = (type) => LEAVE_TYPE_COLORS[type] || "#6b7280";

/* --- Status -------------------------------------------------------------
   'Cancelled' grey hai (MUI `default`) — user-cancelled request ka
   green/red signal na mile, isiliye usko bilkul neutral rakhte hain. */

export const LEAVE_STATUS_META = {
    Approved: { color: "success", colorValue: "#059669" },
    Pending: { color: "warning", colorValue: "#d97706" },
    Rejected: { color: "error", colorValue: "#dc2626" },
    Cancelled: { color: "default", colorValue: "#94a3b8" },
};

export const statusMeta = (status) => LEAVE_STATUS_META[status] || { color: "default", colorValue: "#6b7280" };

/* Filter chips ka order — Cancelled sabse aakhir me, Optional status. */
export const HISTORY_FILTERS = ["All", "Approved", "Pending", "Rejected", "Cancelled"];

/* --- Dates --------------------------------------------------------------
   Neeche sab `leaveService.js` se aate hain (validation + attendance page
   ko wahi logic chahiye, isiliye ek hi jagah hai). Components inhe yahin se
   import karte hain taaki dono jagah same value aaye. */

export {
    countLeaveDays,
    eachDate,
    formatDateTime,
    formatRangeShort,
    parseISODate,
    rangesOverlap,
    remainingOf,
    toISODate,
    toLocalDate,
    todayISO,
} from "../../../services/leaveService";

/* Pura range ek line me — "12 Oct 2026 – 14 Oct 2026" */
export const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/* Mobile card ke liye chhota format — "12 Oct" */
export const formatDateShort = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/* Dono dates ek saath — table ke "From – To" column aur drawer ke liye.
   Single-day leave par sirf ek date (warna "12 Oct – 12 Oct" bekaar lagta). */
export const formatRange = (from, to) => {
    if (!from) return "—";
    if (!to || from === to) return formatDate(from);
    return `${formatDate(from)} – ${formatDate(to)}`;
};

/* --- Balance ------------------------------------------------------------
   Service ka balance `{ Casual:{total,used}, ... }` shape deta hai. Cards
   ko per-type rows + ek overall number chahiye, isliye woh view yahin
   banta hai — dono jagah (leaves page ka card, admin drawer) ek hi
   conversion use karte hain, values kabhi drift nahi karti. */

export const toBalanceView = (balance) => {
    const rows = LEAVE_TYPES.map((type) => {
        const row = balance?.[type] || { total: 0, used: 0 };
        return {
            type,
            total: row.total,
            used: row.used,
            remaining: Math.max(0, row.total - row.used),
        };
    });

    const total = rows.reduce((sum, r) => sum + r.total, 0);
    const used = rows.reduce((sum, r) => sum + r.used, 0);

    return {
        total,
        used,
        remaining: Math.max(0, total - used),
        breakdown: rows,
    };
};

/* Apply dialog ke select labels — "Casual (12 left)". */
export const typeOptionLabel = (type, balance) => {
    const row = balance?.[type];
    const left = row ? Math.max(0, row.total - row.used) : LEAVE_QUOTAS[type] ?? 0;
    return `${type} (${left} left)`;
};
