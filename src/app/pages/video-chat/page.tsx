"use client";

import VideoChatComp from "../../../components/VideoChatComp";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function VideoChatPage() {
  return (
    <>
      <ToastContainer />
      <VideoChatComp />
    </>
  );
}
