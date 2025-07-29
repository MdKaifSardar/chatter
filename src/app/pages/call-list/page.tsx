"use client";

// import CallListComp from "../../../components/CallUsersComp";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CallUsersComp from "../../../components/CallUsersComp";

const CallListPage = () => {
  return (
    <div className="w-full h-fit">
      <ToastContainer />
      <div className="w-full h-fit flex flex-col justify-center items-center">
        <CallUsersComp />
      </div>
    </div>
  );
};

export default CallListPage;
