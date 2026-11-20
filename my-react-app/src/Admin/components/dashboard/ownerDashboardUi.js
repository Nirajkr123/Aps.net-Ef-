const AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #667eea, #764ba2)",
    "linear-gradient(135deg, #f093fb, #f5576c)",
    "linear-gradient(135deg, #4facfe, #00f2fe)",
    "linear-gradient(135deg, #43e97b, #38f9d7)",
    "linear-gradient(135deg, #fa709a, #fee140)",
    "linear-gradient(135deg, #30cfd0, #330867)",
];

export const avatarStyle = (name) => {
    const value = String(name || "?").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return AVATAR_GRADIENTS[value % AVATAR_GRADIENTS.length];
};

export const initialsOf = (name) =>
    String(name || "?")
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

export const formatLongDate = (date = new Date()) =>
    date.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

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

export const formatMonthYear = (month, year) => {
    const name = MONTH_NAMES[Number(month) - 1] || "";
    return name && year ? `${name} ${year}` : "—";
};

export const formatPayrollAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return `₹ ${new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount)}`;
};

export const RUN_STATUS_META = {
    DRAFT: { label: "Draft", className: "is-draft" },
    APPROVED: { label: "Approved", className: "is-approved" },
    PUBLISHED: { label: "Published", className: "is-published" },
};
