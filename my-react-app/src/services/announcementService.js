import http from "./http";

const getRecent = () => http.get("/api/Announcements/recent");

export default { getRecent };
