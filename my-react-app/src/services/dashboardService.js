import http from "./http";

const getSummary = () => http.get("/api/dashboard/summary");

const dashboardService = { getSummary };

export default dashboardService;
