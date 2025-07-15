"use client";
import React from "react";

// Props interface for all required state and functions
interface CallListProps {
  incomingCalls: any[];
  isLoading: boolean;
  acceptOffer: (call: { senderId: string; offer: RTCSessionDescriptionInit }) => void;
  localVideoRef: React.RefObject<HTMLVideoElement>;
}

export default function CallList(props: CallListProps) {
  const {
    incomingCalls,
    isLoading,
    acceptOffer,
    localVideoRef,
  } = props;

  if (!incomingCalls.length) return null;
  return (
    <div className="flex flex-col w-full">
      <h3 className="text-lg font-semibold mb-2 text-left">Incoming Calls</h3>
      <ul className="flex flex-col space-y-2">
        {incomingCalls.length === 0 && (
          <li className="text-gray-500">No calls received yet.</li>
        )}
        {incomingCalls.map((call, idx) => (
          <li
            key={idx}
            className="flex items-center justify-between bg-gray-100 p-3 rounded"
          >
            <span>
              Call from{" "}
              <span className="font-semibold">{call.senderUsername}</span> (ID:{" "}
              {call.senderId})
            </span>
            <button
              onClick={() => acceptOffer(call)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              disabled={isLoading}
            >
              Receive Call
            </button>
          </li>
        ))}
      </ul>
      {/* Optionally show local video preview */}
      <video ref={localVideoRef} autoPlay muted className="hidden" />
    </div>
  );
}
