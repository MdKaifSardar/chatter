"use client";
import React, { useState } from "react";
import { FaChevronDown, FaChevronUp, FaPhoneSlash } from "react-icons/fa";

// Props interface for all required state and functions
interface CallListProps {
  incomingCalls: any[];
  isLoading: boolean;
  acceptOffer: (call: {
    senderId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  rejectCall: (call: {
    senderId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  localVideoRef: React.RefObject<HTMLVideoElement>;
}

export default function CallList(props: CallListProps) {
  const { incomingCalls, isLoading, acceptOffer, rejectCall, localVideoRef } =
    props;

  const [open, setOpen] = useState(true);

  // Always render the container so the accordion panel is always present,
  // but only show the list if there are incoming calls.
  return (
    <div className="w-full">
      <button
        className="flex items-center justify-between w-full px-4 py-3 bg-white border-b border-gray-200 focus:outline-none"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="calllist-panel"
      >
        <span className="text-xl font-semibold text-left">Incoming Calls</span>
        {open ? (
          <FaChevronUp className="ml-2" />
        ) : (
          <FaChevronDown className="ml-2" />
        )}
      </button>
      <div
        id="calllist-panel"
        className={`transition-all duration-300 overflow-hidden ${
          open ? "max-h-[1000px]" : "max-h-0"
        }`}
      >
        {open && (
          <div className="flex flex-col w-full px-2 py-2 md:px-4">
            <ul className="flex flex-col space-y-2">
              {incomingCalls.length === 0 ? (
                <li className="text-gray-500">No calls received yet.</li>
              ) : (
                incomingCalls.map((call, idx) => (
                  <li
                    key={idx}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-100 p-3 rounded w-full"
                  >
                    <span className="break-words">
                      Call from{" "}
                      <span className="font-semibold">
                        {call.senderUsername || "Unknown User"}
                      </span>
                    </span>
                    <div className="flex flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                      <button
                        onClick={() => acceptOffer(call)}
                        className="px-3 py-2 sm:px-4 sm:py-2 bg-green-500 text-white rounded hover:bg-green-600 transition w-full sm:w-auto text-base sm:text-base"
                        disabled={isLoading}
                      >
                        Receive Call
                      </button>
                      <button
                        onClick={() => rejectCall(call)}
                        className="px-3 py-2 sm:px-4 sm:py-2 bg-red-500 text-white rounded hover:bg-red-600 transition w-full sm:w-auto flex items-center gap-2 text-base sm:text-base"
                        disabled={isLoading}
                        title="Reject Call"
                      >
                        <FaPhoneSlash /> Reject
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            {/* Optionally show local video preview */}
            <video ref={localVideoRef} autoPlay muted className="hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
