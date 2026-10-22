import http from "./http";

const getLatest = () => http.get("/api/Payslip/latest");
const getMy = () => http.get("/api/Payslip/my");
const getDownloadUrl = (id) =>
  `${process.env.REACT_APP_API_URL || "http://localhost:5083"}/api/Payslip/download/${id}`;

export default { getLatest, getMy, getDownloadUrl };
