import http from "./http";

const getAll = (params) => http.get("/api/shifts", { params });
const getActive = () => http.get("/api/shifts/active");
const getById = (id) => http.get(`/api/shifts/${id}`);
const create = (data) => http.post("/api/shifts", data);
const update = (id, data) => http.put(`/api/shifts/${id}`, data);
const setStatus = (id, isActive) => http.patch(`/api/shifts/${id}/status`, { isActive });

const bulkAssign = (data) => http.post("/api/shift-assignments/bulk", data);
const getBatches = () => http.get("/api/shift-assignments/batches");
const getBatch = (id) => http.get(`/api/shift-assignments/batches/${id}`);
const getBatchAssignments = (id) =>
  http.get(`/api/shift-assignments/batches/${id}/assignments`);
const cancelBatch = (id) =>
  http.patch(`/api/shift-assignments/batches/${id}/cancel`);

const shiftService = {
  getAll,
  getActive,
  getById,
  create,
  update,
  setStatus,
  bulkAssign,
  getBatches,
  getBatch,
  getBatchAssignments,
  cancelBatch,
};

export default shiftService;
