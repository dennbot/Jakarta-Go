
import Home from './Pages/Home'
import Rekomendasi from './Pages/Rekomendasi'
import About from './Pages/About'
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Component, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase"; // Make sure this path is correct
import LoginRegistForm from './Pages/LoginRegistForm'
import ForgotPassword from './Pages/ForgotPassword'
import DestinationDetail from './Pages/DestinationDetail'
import UserProfilePage from './Components/UserProfilePage'
import RundownDetailPage from './Components/RundownDetailPage'

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  return (

      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/rekomendasi" element={<Rekomendasi />} />
          <Route path="/login" element={<LoginRegistForm />} />
          <Route path="/reset" element={<ForgotPassword />} />
          <Route path="/destination/:id" element={<DestinationDetail />} />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route path="/rundown/:id" element={<RundownDetailPage />} />
        </Routes>

        <ToastContainer />
      </div>

  );
}

export default App;