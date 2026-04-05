import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAMGnQqiKZqwVBPM71tK1p7dSPZXJiTCEw",
  authDomain: "fixkostentool.firebaseapp.com",
  projectId: "fixkostentool",
  storageBucket: "fixkostentool.firebasestorage.app",
  messagingSenderId: "610070273892",
  appId: "1:610070273892:web:0608e2c0a73663c1256471",
  measurementId: "G-S6VEQ80HV7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
