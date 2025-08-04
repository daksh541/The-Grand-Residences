// firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA_YsGCQED9byXhLr964eEZER2dxZh7luE",
  authDomain: "apartment-34739.firebaseapp.com",
  projectId: "apartment-34739",
  storageBucket: "apartment-34739.appspot.com",
  messagingSenderId: "629128067627",
  appId: "1:629128067627:web:452591a20aceb7bb12486e",
  measurementId: "G-CM936HSRDC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // Added 'export'
export const auth = getAuth(app);   // Added 'export'