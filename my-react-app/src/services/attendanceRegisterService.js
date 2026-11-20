import http from "./http";

const BASE = "/api/attendance/register";

const toRegisterError = (error, fallback) => {
    const message =
        error?.response?.data?.message ||
        error?.response?.data?.title ||
        error?.message ||
        fallback;

    const err = new Error(message);
    err.status = error?.response?.status ?? 0;
    return err;
};

const filenameFromHeaders = (headers, fallback) => {
    const disposition =
        headers?.["content-disposition"] || headers?.["Content-Disposition"] || "";
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
    if (!match?.[1]) return fallback;
    try {
        return decodeURIComponent(match[1].replace(/"/g, "").trim());
    } catch {
        return match[1].replace(/"/g, "").trim();
    }
};

const attendanceRegisterService = {
    async getRegister(params) {
        try {
            const { data } = await http.get(BASE, { params });
            return data;
        } catch (error) {
            throw toRegisterError(error, "Could not load the attendance register.");
        }
    },

    async getCell(employeeId, date) {
        try {
            const { data } = await http.get(`${BASE}/cell/${employeeId}/${date}`);
            return data;
        } catch (error) {
            throw toRegisterError(error, "Could not load this attendance day.");
        }
    },

    async markAttendance(payload) {
        try {
            const { data } = await http.post(`${BASE}/mark`, payload);
            return data;
        } catch (error) {
            throw toRegisterError(error, "Attendance could not be updated.");
        }
    },

    async lockMonth(payload) {
        try {
            const { data } = await http.post(`${BASE}/lock`, payload);
            return data;
        } catch (error) {
            throw toRegisterError(error, "The register could not be locked.");
        }
    },

    async getLockHistory(month) {
        try {
            const { data } = await http.get(`${BASE}/lock-history`, {
                params: { month },
            });
            return data || [];
        } catch (error) {
            throw toRegisterError(error, "Could not load lock history.");
        }
    },

    async getSettings() {
        try {
            const { data } = await http.get(`${BASE}/settings`);
            return data;
        } catch (error) {
            throw toRegisterError(error, "Could not load register settings.");
        }
    },

    async updateSettings(payload) {
        try {
            const { data } = await http.put(`${BASE}/settings`, payload);
            return data;
        } catch (error) {
            throw toRegisterError(error, "Register settings could not be saved.");
        }
    },

    async exportRegister(params, fallbackName) {
        try {
            const response = await http.get(`${BASE}/export`, {
                params,
                responseType: "blob",
            });
            return {
                blob: response.data,
                filename: filenameFromHeaders(response.headers, fallbackName),
            };
        } catch (error) {
            throw toRegisterError(error, "The register could not be exported.");
        }
    },

    async getPayrollTotals(month) {
        try {
            const { data } = await http.get(`${BASE}/payroll-totals`, {
                params: { month },
            });
            return data || {};
        } catch (error) {
            throw toRegisterError(error, "Payroll totals could not be loaded.");
        }
    },
};

export default attendanceRegisterService;
