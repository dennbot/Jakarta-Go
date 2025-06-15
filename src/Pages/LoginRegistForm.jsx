"use client";

import React, { useState } from "react";
import { FaUser, FaLock, FaEnvelope } from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

// firebase import
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { setDoc, doc } from "firebase/firestore";

const LoginRegistForm = () => {
  const [action, setAction] = useState("");
  const navigate = useNavigate();

  // State for form fields
  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });

  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: ""
  });

  const [isLoading, setIsLoading] = useState(false);

  const registerLink = (e) => {
    e.preventDefault();
    setLoginData({ email: "", password: "" });
    setAction(" active");
  };

  const loginLink = (e) => {
    e.preventDefault();
    setRegisterData({ username: "", email: "", password: "" });
    setAction("");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, registerData.email, registerData.password);
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "Users", user.uid), {
          email: user.email,
          username: registerData.username,
        });
      }
      toast.success("User Registered Successfully!!", {
        position: "top-center",
      });
      navigate("/");
    } catch (error) {
      toast.error(error.message, { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginData.email, loginData.password);
      toast.success("User logged in successfully, Welcome to Jakarta!", {
        position: "top-center",
      });
      navigate("/");
    } catch (error) {
      toast.error(error.message, { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    navigate("/reset");
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <div className={`w-[420px] h-[450px] ${action === " active" ? "h-[520px]" : ""} bg-white text-black rounded-lg relative flex items-center overflow-hidden transition-[height] duration-200 mx-auto`}>
        {/* Login Form */}
        <div className={`w-full p-10 ${action === " active" ? "translate-x-[-400px] transition-none" : "translate-x-0 transition-transform duration-[0.18s] ease-in"}`}>
          <form onSubmit={handleLoginSubmit}>
            <h1 className="text-4xl text-center">Login</h1>
            <div className="relative w-full h-[50px] my-8">
              <input
                type="email"
                placeholder="Enter email"
                value={loginData.email}
                onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                required
                className="w-full h-full bg-[rgb(237,226,226)] outline-none border-2 border-[rgba(255,255,255,0.2)] rounded-[40px] text-base text-black py-5 pr-12 pl-5 shadow-md"
              />
              <FaUser className="absolute right-5 top-1/2 -translate-y-1/2 text-base" />
            </div>
            <div className="relative w-full h-[50px] my-8">
              <input
                type="password"
                placeholder="Password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                required
                className="w-full h-full bg-[rgb(237,226,226)] outline-none border-2 border-[rgba(255,255,255,0.2)] rounded-[40px] text-base text-black py-5 pr-12 pl-5 shadow-md"
              />
              <FaLock className="absolute right-5 top-1/2 -translate-y-1/2 text-base" />
            </div>
            <div className="flex justify-end text-sm -mt-4 mb-4">
              <a href="#" onClick={handleReset} className="text-[#1e81b0] hover:underline">
                Lupa Password?
              </a>
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-[45px] bg-[#1e81b0] border-none outline-none rounded-[40px] shadow-md cursor-pointer text-base text-white font-bold hover:bg-[#007BFF] hover:border hover:border-[#0056b3] hover:shadow-lg disabled:opacity-70"
            >
              {isLoading ? "Processing..." : "Login"}
            </button>
            <div className="text-sm text-center mt-5 mb-4">
              <p>
                Tidak memiliki Akun?{" "}
                <a href="#" onClick={registerLink} className="text-[#1e81b0] no-underline font-semibold hover:underline">
                  Register
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Registration Form */}
        <div className={`absolute w-full p-10 ${action === " active" ? "translate-x-0 transition-transform duration-[0.18s] ease-in" : "translate-x-[400px] transition-none"}`}>
          <form onSubmit={handleRegister}>
            <h1 className="text-4xl text-center">Registration</h1>
            <div className="relative w-full h-[50px] my-8">
              <input
                type="text"
                placeholder="Username"
                value={registerData.username}
                onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                required
                className="w-full h-full bg-[rgb(237,226,226)] outline-none border-2 border-[rgba(255,255,255,0.2)] rounded-[40px] text-base text-black py-5 pr-12 pl-5 shadow-md"
              />
              <FaUser className="absolute right-5 top-1/2 -translate-y-1/2 text-base" />
            </div>
            <div className="relative w-full h-[50px] my-8">
              <input
                type="email"
                placeholder="Email"
                value={registerData.email}
                onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                required
                className="w-full h-full bg-[rgb(237,226,226)] outline-none border-2 border-[rgba(255,255,255,0.2)] rounded-[40px] text-base text-black py-5 pr-12 pl-5 shadow-md"
              />
              <FaEnvelope className="absolute right-5 top-1/2 -translate-y-1/2 text-base" />
            </div>
            <div className="relative w-full h-[50px] my-8">
              <input
                type="password"
                placeholder="Password"
                value={registerData.password}
                onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                required
                className="w-full h-full bg-[rgb(237,226,226)] outline-none border-2 border-[rgba(255,255,255,0.2)] rounded-[40px] text-base text-black py-5 pr-12 pl-5 shadow-md"
              />
              <FaLock className="absolute right-5 top-1/2 -translate-y-1/2 text-base" />
            </div>
            <div className="flex justify-between text-sm -mt-4 mb-4">
              <label className="flex items-center">
                <input type="checkbox" required className="accent-black mr-1" />
                Saya Setuju dengan Segala Ketentuan
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-[45px] bg-[#1e81b0] border-none outline-none rounded-[40px] shadow-md cursor-pointer text-base text-white font-bold hover:bg-[#007BFF] hover:border hover:border-[#0056b3] hover:shadow-lg disabled:opacity-70"
            >
              {isLoading ? "Processing..." : "Register"}
            </button>

            <div className="text-sm text-center mt-5 mb-4">
              <p>
                Sudah memiliki Akun?{" "}
                <a href="#" onClick={loginLink} className="text-[#1e81b0] no-underline font-semibold hover:underline">
                  Login
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginRegistForm;
