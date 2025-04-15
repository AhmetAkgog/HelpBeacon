// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// 👇 Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBI_uCAU97AlJHrc6CkuffudW-yPpFu7gk",
  authDomain: "helpbeacon-a3a42.firebaseapp.com",
  projectId: "helpbeacon-a3a42",
  storageBucket: "helpbeacon-a3a42.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "1:385066902657:android:af96ce0235cf3f80c2d980",
  databaseURL: "YOUR_DATABASE_URL", // if using Realtime DB
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };