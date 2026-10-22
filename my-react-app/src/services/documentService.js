import http from "./http";

const getMy = () => http.get("/api/EmployeeDocument/my");
const create = (data) => http.post("/api/EmployeeDocument", data);
const remove = (id) => http.delete(`/api/EmployeeDocument/${id}`);
const upload = (docType, employeeId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return http.post(
    `/api/Document/upload?documentType=${docType}&employeeId=${employeeId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};
const getByEmployee = (employeeId) => http.get(`/api/EmployeeDocument/employee/${employeeId}`);
const getDocsByEmployee = (employeeId) => http.get(`/api/Document/employee/${employeeId}`);
const removeByType = (employeeId, docType) => http.delete(`/api/Document/employee/${employeeId}/type/${docType}`);

export default { getMy, create, remove, upload, getByEmployee, getDocsByEmployee, removeByType };
