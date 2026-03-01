import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC0KLpJyCl9Qkxp-YSCQXR1-JGMGdND8a4",
  authDomain: "ai-study-platform-933ea.firebaseapp.com",
  projectId: "ai-study-platform-933ea",
  storageBucket: "ai-study-platform-933ea.firebasestorage.app",
  messagingSenderId: "346969257958",
  appId: "1:346969257958:web:e4bd05a1e167c9dc33c827"
};

const app = getApps().length === 0 
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);