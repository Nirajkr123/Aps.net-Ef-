import http from "./http";

const getAll = (limit = 20, offset = 0) => http.get("/api/Notifications", { params: { limit, offset } });

const getUnreadCount = () => http.get("/api/Notifications/unread-count");

const markRead = (ids) => http.put("/api/Notifications/mark-read", { ids });

const markAllRead = () => http.put("/api/Notifications/mark-all-read");

const registerDeviceToken = (token) =>
  http.post("/api/Notifications/device-token", { token, userAgent: navigator.userAgent });

const unregisterDeviceToken = (token) =>
  http.delete("/api/Notifications/device-token", { params: { token } });

const broadcast = (payload) => http.post("/api/Notifications/broadcast", payload);

export default {
  getAll,
  getUnreadCount,
  markRead,
  markAllRead,
  registerDeviceToken,
  unregisterDeviceToken,
  broadcast,
};
