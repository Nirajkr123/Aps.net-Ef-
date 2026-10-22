import http from "./http";

const getUpcoming = () => http.get("/api/Holidays/upcoming");

export default { getUpcoming };
