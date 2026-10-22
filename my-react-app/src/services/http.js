import axios from "axios";

const http = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5083",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const currentPath = window.location.pathname;

    if (status === 401 && currentPath !== "/login") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } else if (status === 403) {
      console.error("403 Forbidden:", err.config?.url);
    } else if (status >= 500) {
      console.error(`${status} Server Error:`, err.config?.url);
    } else if (!err.response && err.request) {
      console.error("Network Error:", err.message);
    }

    return Promise.reject(err);
  }
);

export default http;
