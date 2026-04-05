import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAQkvum7l4INzi2hEe9sO3l7nSpBl8gV_s",
  authDomain: "guccora-d0921.firebaseapp.com",
  projectId: "guccora-d0921",
  storageBucket: "guccora-d0921.firebasestorage.app",
  messagingSenderId: "974110971630",
  appId: "1:974110971630:web:2ee640db0f702f796a45ff",
};

export const isFirebaseConfigured = true;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");
