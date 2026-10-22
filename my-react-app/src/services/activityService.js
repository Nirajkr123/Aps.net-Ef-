import http from "./http";

const getRecent = () => http.get("/api/Activity/recent");

export default { getRecent };
