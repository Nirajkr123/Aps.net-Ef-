import http from "./http";

const getMe = () => http.get("/api/Employee/me");
const updateMe = (data) => http.put("/api/Employee/me/update", data);
const uploadPhoto = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return http.put("/api/Employee/me/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
const getMyPhoto = () => http.get("/api/Employee/me/photo");
const getAll = (params) => http.get("/api/Employee", { params });
const getById = (id) => http.get(`/api/Employee/${id}`);
const create = (data) => http.post("/api/Employee", data);
const update = (id, data) => http.put(`/api/Employee/${id}`, data);
const toggleAction = (id, action) => http.patch(`/api/Employee/${id}/${action}`);
const getAttendanceSummary = () => http.get("/api/attendance/my-history", {
  params: {
    fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
  },
}).then(({ data }) => {
  const summary = { present: 0, absent: 0, late: 0 };
  (Array.isArray(data) ? data : []).forEach((r) => {
    const s = (r.status || "").toLowerCase();
    if (s === "present") summary.present++;
    else if (s === "late") summary.late++;
    else if (s === "absent") summary.absent++;
    else summary.present++;
  });
  return { data: summary };
});
const getWeeklyAttendance = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return http.get("/api/attendance/my-history", {
    params: {
      fromDate: monday.toISOString().split("T")[0],
      toDate: sunday.toISOString().split("T")[0],
    },
  }).then(({ data }) => {
    const week = Array(7).fill(null);
    (Array.isArray(data) ? data : []).forEach((r) => {
      const d = new Date(r.attendanceDate || r.date);
      const idx = (d.getDay() + 6) % 7;
      week[idx] = {
        date: r.attendanceDate || r.date,
        checkIn: r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
        checkOut: r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
      };
    });
    return { data: week };
  });
};

export default {
  getMe,
  updateMe,
  uploadPhoto,
  getMyPhoto,
  getAll,
  getById,
  create,
  update,
  toggleAction,
  getAttendanceSummary,
  getWeeklyAttendance,
};
