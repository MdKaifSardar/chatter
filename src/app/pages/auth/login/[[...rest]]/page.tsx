"use client";

import { SignIn } from "@clerk/nextjs";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const LoginPage = () => {
  return (
    <>
      <ToastContainer />
      <div className="w-full h-fit py-[3rem] flex flex-col justify-center items-center">
        <SignIn
          path="/pages/auth/login"
          routing="path"
          signUpUrl="/pages/auth/register"
        />
      </div>
    </>
  );
};

export default LoginPage;
