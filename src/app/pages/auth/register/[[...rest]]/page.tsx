"use client";

import { SignUp } from "@clerk/nextjs";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function RegisterPage() {
  return (
    <>
      <ToastContainer />
      <div className="w-full h-screen flex flex-col justify-center items-center">
        <SignUp
          path="/pages/auth/register"
          routing="path"
          signInUrl="/pages/auth/sign-in"
        />
      </div>
    </>
  );
}
