import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDemo-replace-with-real-key",
  authDomain: "guccora-mlm.firebaseapp.com",
  projectId: "guccora-mlm",
  storageBucket: "guccora-mlm.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Functions pointed at the asia-south1 region (Mumbai)
export const functions = getFunctions(app, "asia-south1");
