import http from "./http";

const getDashboard = () => http.get("/api/Admin/dashboard");
const getStates = () => http.get("/api/Admin/states");
const getDistricts = (stateId) =>
  stateId
    ? http.get(`/api/Admin/districts?stateId=${stateId}`)
    : http.get("/api/Admin/districts");

const getUsers = () => http.get("/api/Admin/users");
const createUser = (data) => http.post("/api/Admin/users", data);
const updateUser = (id, data) => http.put(`/api/Admin/users/${id}`, data);
const deleteUser = (id) => http.delete(`/api/Admin/users/${id}`);
const toggleUser = (id, action) => http.post(`/api/Admin/users/${id}/${action}`);
const assignRole = (id, role) => http.post(`/api/Admin/users/${id}/role`, { role });
const resetPassword = (id, data) => http.post(`/api/Admin/users/${id}/reset-password`, data);
const logoutLog = (data) => http.post("/api/User/logout-log", data);

const createState = (data) => http.post("/api/Admin/states", data);
const updateState = (id, data) => http.put(`/api/Admin/states/${id}`, data);
const deleteState = (id) => http.delete(`/api/Admin/states/${id}`);

const createDistrict = (data) => http.post("/api/Admin/districts", data);
const updateDistrict = (id, data) => http.put(`/api/Admin/districts/${id}`, data);
const deleteDistrict = (id) => http.delete(`/api/Admin/districts/${id}`);

// ===================== Attendance (Admin side) =====================
const getAllAttendance = (params) => {
  // params = { date, employeeId, month, year } - jo bhi filter chahiye
  const query = new URLSearchParams(params).toString();
  return http.get(`/api/Attendance/all${query ? `?${query}` : ""}`);
};

const markAttendance = (data) => http.post("/api/Attendance/mark", data);
// data = { employeeId, date, status, remarks }

const updateAttendance = (id, data) => http.put(`/api/Attendance/${id}`, data);

const getAttendanceRequests = () => http.get("/api/Attendance/requests"); // pending corrections
const approveAttendanceRequest = (id) => http.post(`/api/Attendance/requests/${id}/approve`);
const rejectAttendanceRequest = (id) => http.post(`/api/Attendance/requests/${id}/reject`);

const exportAttendanceReport = (params) => {
  const query = new URLSearchParams(params).toString();
  return http.get(`/api/Attendance/export${query ? `?${query}` : ""}`, {
    responseType: "blob",
  });
};

// ===================== Work Locations =====================
const getWorkLocations = () => http.get("/api/work-locations");
const getActiveWorkLocations = () => http.get("/api/work-locations/active");
const createWorkLocation = (data) => http.post("/api/work-locations", data);
const updateWorkLocation = (id, data) => http.put(`/api/work-locations/${id}`, data);
const setWorkLocationActive = (id, isActive) =>
  http.patch(`/api/work-locations/${id}/active`, { isActive });

export default {
  getDashboard, getStates, getDistricts,
  getUsers, createUser, updateUser, deleteUser, toggleUser, assignRole, resetPassword, logoutLog,
  createState, updateState, deleteState,
  createDistrict, updateDistrict, deleteDistrict,

  // Attendance
  getAllAttendance,
  markAttendance,
  updateAttendance,
  getAttendanceRequests,
  approveAttendanceRequest,
  rejectAttendanceRequest,
  exportAttendanceReport,

  // Work Locations
  getWorkLocations,
  getActiveWorkLocations,
  createWorkLocation,
  updateWorkLocation,
  setWorkLocationActive,
};
