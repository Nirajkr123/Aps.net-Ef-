import http from "./http";

const getToday = () => http.get("/api/attendance/today");
const getMyHistory = (fromDate, toDate) =>
  http.get("/api/attendance/my-history", { params: { fromDate, toDate } });
const checkIn = (location) => http.post("/api/attendance/checkin", location);
const checkOut = (location) => http.post("/api/attendance/checkout", location);
const getAll = (filter = {}) =>
  http.get("/api/attendance/all", { params: filter });
const update = (id, data) => http.put(`/api/attendance/${id}`, data);

export default { getToday, getMyHistory, checkIn, checkOut, getAll, update };
