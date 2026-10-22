// Firebase Cloud Messaging background service worker
// NOTE: uses compat CDN build because service workers cannot use ESM imports.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAt6LIS12-shsv9sloqFfLTogh9aMS3vn0",
  authDomain: "demootpapp-cb6ff.firebaseapp.com",
  projectId: "demootpapp-cb6ff",
  storageBucket: "demootpapp-cb6ff.firebasestorage.app",
  messagingSenderId: "1087506391178",
  appId: "1:1087506391178:web:18e9a8e496340047a04d73",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "HRMS";
  const options = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/logo192.png",
    data: { link: payload.data?.link || "/" },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(clients.openWindow(link));
});
