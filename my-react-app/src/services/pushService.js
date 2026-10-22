import { getToken, isSupported, onMessage } from "firebase/messaging";
import { messaging } from "../firebase";
import { VAPID_KEY } from "./vapidKey";

const SW_PATH = "/firebase-messaging-sw.js";
const SW_TIMEOUT_MS = 8000;

let started = false;

const isBrowserSupported = () =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker timeout")), ms)),
  ]);

export const ensureServiceWorker = async () => {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;

  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
};

export const requestPermissionAndGetToken = async () => {
  if (!isBrowserSupported() || !messaging) return null;
  if (!(await isSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await withTimeout(ensureServiceWorker(), SW_TIMEOUT_MS);
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
};

export const listenForMessages = (onMessageReceived) => {
  if (started || !messaging) return () => {};
  started = true;

  return onMessage(messaging, (payload) => {
    onMessageReceived?.(payload);
  });
};
