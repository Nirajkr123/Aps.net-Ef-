import {
    formatCurrency,
    formatMonthYear,
    splitLineItems,
} from "../../../Employee/components/payslips/payslipUi";

export { formatCurrency, formatMonthYear, splitLineItems };

export const RUN_STATUS_LABELS = {
    DRAFT: "Draft",
    APPROVED: "Approved",
    PUBLISHED: "Published",
};

export const ACTIVE_JOB_STATUSES = ["QUEUED", "RUNNING", "RETRYING"];

export function getRunStatusLabel(status) {
    return RUN_STATUS_LABELS[String(status || "").toUpperCase()] || "No run";
}

export function getReviewStatus(payslip) {
    if (Number(payslip?.warningsCount) > 0) {
        return { key: "warning", label: "Warning" };
    }
    if (Number(payslip?.lopDays) > 0) {
        return { key: "lop", label: "LOP applied" };
    }
    return { key: "ok", label: "OK" };
}

export function getRunSteps(run, payslips, jobs) {
    const status = run?.status;
    const hasActiveCalculation = jobs.some(
        (job) => job.type === "CALCULATE_RUN" && ACTIVE_JOB_STATUSES.includes(job.status)
    );
    let currentIndex = 0;

    if (status === "PUBLISHED" || status === "APPROVED") {
        currentIndex = 3;
    } else if (!hasActiveCalculation && payslips.length > 0) {
        currentIndex = 1;
    }

    return ["Calculate", "Review", "Approve", "Publish"].map((label, index) => ({
        key: label.toLowerCase(),
        label,
        state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    }));
}

export function getPdfProgress(run, payslips, jobs) {
    const pdfJobs = jobs.filter((job) => job.type === "GENERATE_PDF");
    const total = Number(run?.employeeCount) || payslips.length || pdfJobs.length;
    const succeeded = pdfJobs.filter((job) => job.status === "SUCCEEDED").length;
    const failed = pdfJobs.filter((job) => job.status === "FAILED").length;
    const active = pdfJobs.filter((job) => ACTIVE_JOB_STATUSES.includes(job.status)).length;

    return {
        total,
        succeeded,
        failed,
        active,
        visible: total > 0 && (run?.status === "PUBLISHED" || pdfJobs.length > 0),
    };
}
