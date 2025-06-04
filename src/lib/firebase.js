// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsk4FqMmkZbNKImBn8Czxpexnc1ml0WyI",
  authDomain: "jakarta-go-authentication.firebaseapp.com",
  projectId: "jakarta-go-authentication",
  storageBucket: "jakarta-go-authentication.firebasestorage.app",
  messagingSenderId: "235330126727",
  appId: "1:235330126727:web:3d4dbdd79f64caeff50922"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth=getAuth();
export const db=getFirestore(app);
export default app;