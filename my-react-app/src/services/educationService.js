import http from "./http";

const getMy = () => http.get("/api/Education/my");
const create = (data) => http.post("/api/Education", data);
const update = (id, data) => http.put(`/api/Education/${id}`, data);
const getByEmployee = (employeeId) => http.get(`/api/Education/employee/${employeeId}`);

export default { getMy, create, update, getByEmployee };
