"use client";

import CallListComp from "../../../components/CallUsersComp";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const CallListPage = () => {
  return (
    <div className="w-full h-fit">
      <ToastContainer />
      <div className="w-full h-fit py-[3rem] flex flex-col justify-center items-center">
        <CallListComp />
      </div>
    </div>
  );
};

export default CallListPage;
