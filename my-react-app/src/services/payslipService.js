import http from "./http";

const getLatest = () => http.get("/api/me/payslips/latest");
const getMy = (params = {}) => http.get("/api/me/payslips", { params });
const getById = (id) => http.get(`/api/me/payslips/${id}`);

const download = (id) =>
  http.get(`/api/me/payslips/${id}/download`, { responseType: "blob" });

const downloadPayslip = async (id, fileName) => {
  const response = await download(id);
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName || `payslip-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const payslipService = { getLatest, getMy, getById, download, downloadPayslip };

export default payslipService;
