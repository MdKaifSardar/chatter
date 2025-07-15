"use client";

import { RefObject, useState } from "react";
import { FaPhoneSlash, FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

interface VideoChatCompNewProps {
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  endCall: () => void;
  // Add any other props you need
}

export default function VideoChatCompNew({
  localVideoRef,
  remoteVideoRef,
  localStream,
  peerConnection,
  endCall,
}: VideoChatCompNewProps) {
  // Track toggled state for video/audio
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Toggle local video tracks
  const toggleLocalVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled((prev) => !prev);
    }
  };

  // Toggle local audio tracks
  const toggleLocalAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled((prev) => !prev);
    }
  };

  // Only show controls if the call has started (peerConnection exists)
  const callStarted = !!peerConnection;

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative z-50">
      <video
        ref={remoteVideoRef}
        autoPlay
        className="absolute top-0 left-auto right-auto h-full w-auto object-contain md:object-cover transform scale-x-[-1]"
      />
      <div className="absolute top-4 left-4 w-48 h-36 bg-black border border-gray-700 rounded-lg overflow-hidden md:w-64 md:h-48">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="w-full h-full object-contain transform scale-x-[-1]"
        />
      </div>
      {/* Controls: Only show when call has started */}
      {callStarted && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
          <button
            onClick={toggleLocalVideo}
            className={`flex items-center gap-2 px-4 py-3 ${
              videoEnabled
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-gray-700 hover:bg-gray-800"
            } text-white rounded-full text-lg shadow-lg transition`}
            title={videoEnabled ? "Turn Off Video" : "Turn On Video"}
          >
            {videoEnabled ? <FaVideo /> : <FaVideoSlash />}{" "}
            {videoEnabled ? "Turn Off Video" : "Turn On Video"}
          </button>
          <button
            onClick={toggleLocalAudio}
            className={`flex items-center gap-2 px-4 py-3 ${
              audioEnabled
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-700 hover:bg-gray-800"
            } text-white rounded-full text-lg shadow-lg transition`}
            title={audioEnabled ? "Mute Audio" : "Unmute Audio"}
          >
            {audioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}{" "}
            {audioEnabled ? "Mute Audio" : "Unmute Audio"}
          </button>
          <button
            onClick={endCall}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full text-lg shadow-lg hover:bg-red-700 transition"
            title="End Call"
          >
            <FaPhoneSlash className="mr-2" /> End Call
          </button>
        </div>
      )}
    </div>
  );
}
