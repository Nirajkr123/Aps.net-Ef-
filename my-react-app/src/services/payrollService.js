import http from "./http";

const getRuns = () => http.get("/api/payroll/runs");
const getRun = (id) => http.get(`/api/payroll/runs/${id}`);
const getPayslips = (runId, params = {}) =>
    http.get(`/api/payroll/runs/${runId}/payslips`, { params });
const getPayslip = (id) => http.get(`/api/payroll/payslips/${id}`);
const getJobs = (runId) => http.get(`/api/payroll/runs/${runId}/jobs`);
const createRun = (payload) => http.post("/api/payroll/runs", payload);
const recalculate = (runId) => http.post(`/api/payroll/runs/${runId}/recalculate`);
const approve = (runId) => http.post(`/api/payroll/runs/${runId}/approve`);
const publish = (runId) => http.post(`/api/payroll/runs/${runId}/publish`);
const addAdjustment = (payslipId, payload) =>
    http.post(`/api/payroll/payslips/${payslipId}/adjustments`, payload);
const getHolidays = (year) =>
    http.get("/api/payroll/holidays", { params: { year } });
const getWeekOffDays = () => http.get("/api/payroll/week-off-days");

const payrollService = {
    getRuns,
    getRun,
    getPayslips,
    getPayslip,
    getJobs,
    createRun,
    recalculate,
    approve,
    publish,
    addAdjustment,
    getHolidays,
    getWeekOffDays,
};

export default payrollService;
