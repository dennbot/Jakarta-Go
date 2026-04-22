"use client";

import React from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase"; 
import { useNavigate } from "react-router-dom";

function ForgotPassword({ onClose }) {
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailVal = e.target.email.value;
    sendPasswordResetEmail(auth, emailVal)
      .then(() => {
        alert("Check your Email");
        onClose();
        navigate("/");
      })
      .catch((err) => {
        alert(err.code);
      });
  };

  const handleClose = () => {
    navigate("/login");
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-[1000]">
      <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-[400px] p-8 relative mx-auto">
        <button 
          className="absolute top-4 right-4 bg-transparent border-none text-[22px] text-gray-500 cursor-pointer p-0 leading-none hover:text-gray-800" 
          onClick={handleClose}
        >
          ×
        </button>
        <h1 className="text-gray-800 mt-0 mb-5 text-2xl text-center">Forgot Password</h1>
        <form
          className="flex flex-col w-full"
          onSubmit={(e) => handleSubmit(e)}
        >
          <input
            className="py-3 px-4 mb-5 border border-gray-300 rounded-md text-base w-full box-border focus:outline-none focus:border-[#4285f4] focus:shadow-[0_0_0_2px_rgba(66,133,244,0.2)]"
            name="email"
            placeholder="Enter your email"
          />
          <button className="bg-[#4285f4] text-white border-none py-3 px-0 rounded-md text-base font-bold cursor-pointer transition-colors duration-300 hover:bg-[#3367d6]">
            Reset
          </button>
        </form>
      </div>
      
      <style jsx>{`
        @keyframes forgotPasswordFadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default ForgotPassword;