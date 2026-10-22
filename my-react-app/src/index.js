import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Push notifications ke liye `pushService.js` ek service worker `scope: "/"`
// ke saath register karta hai — jo poore origin ko control kar leta hai.
// Active SW hone par browser page apne cache se serve karta hai aur
// `Ctrl+Shift+R` bhi use bypass nahi karta. Isi wajah se CSS/JS changes
// refresh ke baad bhi nahi dikhte the aur purana build render hota raha.
// Dev me har boot pe SW unregister karke saare caches wipe kar dete hain,
// taaki ek normal refresh hamesha fresh code de.
async function purgeDevCaches() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // SW mila tha to ek baar reload — uske baad page fresh bundle se aayega
    if (registrations.length > 0) window.location.reload();
  } catch {
    /* cache API unavailable — ignore */
  }
}

if (process.env.NODE_ENV === 'development') {
  purgeDevCaches();
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
