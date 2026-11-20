export const AMOUNT_HIDDEN_KEY = "payslipAmountsHidden";

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const PROCESSING_STATUSES = ["DRAFT", "PROCESSING", "PENDING", "QUEUED", "RUNNING"];

export function formatMonthYear(month, year, uppercase = false) {
    const name = MONTH_NAMES[Number(month) - 1] || "";
    if (!name || !year) return "—";
    const label = `${name} ${year}`;
    return uppercase ? label.toUpperCase() : label;
}

export function formatCurrency(value, hidden = false) {
    if (hidden) return "₹ ••••••";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return `₹ ${new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount)}`;
}

export function getPayslipStatus(payslip) {
    const status = String(payslip?.status || "").toUpperCase();
    if (PROCESSING_STATUSES.includes(status)) {
        return { key: "processing", label: "Processing", canDownload: false };
    }
    if (Number(payslip?.version) > 1) {
        return { key: "corrected", label: "Corrected", canDownload: true };
    }
    return { key: "ready", label: "Ready", canDownload: true };
}

export function splitLineItems(items) {
    const safeItems = Array.isArray(items) ? items : [];
    return {
        earnings: safeItems.filter((item) => Number(item.amount) >= 0),
        deductions: safeItems.filter((item) => Number(item.amount) < 0),
    };
}
