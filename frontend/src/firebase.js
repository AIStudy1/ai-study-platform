// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
const firebaseConfig = {
  apiKey: "AIzaSyC0KLpJyCl9Qkxp-YSCQXR1-JGMGdND8a4",
  authDomain: "ai-study-platform-933ea.firebaseapp.com",
  projectId: "ai-study-platform-933ea",
  storageBucket: "ai-study-platform-933ea.firebasestorage.app",
  messagingSenderId: "346969257958",
  appId: "1:346969257958:web:e4bd05a1e167c9dc33c827",
  measurementId: "G-GV55S80CEB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app); // <-- export DB