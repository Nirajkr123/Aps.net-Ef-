import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";


import { getFirestore } from "firebase/firestore";       // NEW
import { getMessaging } from "firebase/messaging"; 

const firebaseConfig = {
  apiKey: "AIzaSyAt6LIS12-shsv9sloqFfLTogh9aMS3vn0",
  authDomain: "demootpapp-cb6ff.firebaseapp.com",
  projectId: "demootpapp-cb6ff",
  storageBucket: "demootpapp-cb6ff.firebasestorage.app",
  messagingSenderId: "1087506391178",
  appId: "1:1087506391178:web:18e9a8e496340047a04d73"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);          // NEW

let messagingInstance = null;
try {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    messagingInstance = getMessaging(app);
  }
} catch {
  messagingInstance = null;
}
export const messaging = messagingInstance;   // NEW

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
};
