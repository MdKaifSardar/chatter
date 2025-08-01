"use client";

import { RefObject, useState, useEffect } from "react";
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
  remoteStream,
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

  // Only show controls and local video if the call has started (peerConnection exists)
  const callStarted = !!peerConnection;

  // Ensure local video element always gets the correct stream and plays when localStream changes
  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = null;
    if (localStream && callStarted) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
      let tries = 0;
      const playVideo = () => {
        if (!localVideoRef.current) return;
        if (localVideoRef.current.readyState > 0) {
          localVideoRef.current
            .play()
            .catch(() => {
              tries++;
              if (tries < 15) setTimeout(playVideo, 100);
            });
        } else {
          tries++;
          if (tries < 15) setTimeout(playVideo, 100);
        }
      };
      playVideo();
    }
  }, [localStream, localVideoRef, callStarted]);

  // Ensure remote video element always gets the correct stream and plays when remoteStream changes
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = null;
    if (remoteStream && callStarted) {
      remoteVideoRef.current.srcObject = remoteStream;
      let tries = 0;
      const playRemote = () => {
        if (!remoteVideoRef.current) return;
        if (remoteVideoRef.current.readyState > 0) {
          remoteVideoRef.current
            .play()
            .catch(() => {
              tries++;
              if (tries < 15) setTimeout(playRemote, 100);
            });
        } else {
          tries++;
          if (tries < 15) setTimeout(playRemote, 100);
        }
      };
      playRemote();
    }
  }, [remoteStream, remoteVideoRef, callStarted]);

  // Only render remote video if call is started and remoteStream exists
  // Always render the ref, but only attach stream and show video when needed
  return (
    <div className="w-full flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative z-50">
      <div className="absolute inset-0">
        {callStarted && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            className="absolute top-0 left-auto right-auto h-full w-auto object-contain md:object-cover transform scale-x-[-1]"
          />
        ) : (
          // Always keep the ref present in the DOM, but hidden when not in use
          <video
            ref={remoteVideoRef}
            style={{ display: "none" }}
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
      </div>
      {/* Only render local video if call is started and stream exists */}
      {callStarted && localStream && (
        <div className="absolute top-4 left-4 w-48 h-36 bg-black border border-gray-700 rounded-lg overflow-hidden md:w-64 md:h-48">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            className="w-full h-full object-contain transform scale-x-[-1]"
          />
        </div>
      )}
      {/* Controls: Only show when call has started */}
      {callStarted && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-row gap-4 w-full justify-center px-4">
          <button
            onClick={toggleLocalVideo}
            className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16
              ${
                videoEnabled
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : "bg-gray-700 hover:bg-gray-800"
              } text-white rounded-full shadow-lg transition`}
            title={videoEnabled ? "Turn Off Video" : "Turn On Video"}
          >
            {videoEnabled ? <FaVideo size={28} /> : <FaVideoSlash size={28} />}
          </button>
          <button
            onClick={toggleLocalAudio}
            className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16
              ${
                audioEnabled
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-700 hover:bg-gray-800"
              } text-white rounded-full shadow-lg transition`}
            title={audioEnabled ? "Mute Audio" : "Unmute Audio"}
          >
            {audioEnabled ? <FaMicrophone size={28} /> : <FaMicrophoneSlash size={28} />}
          </button>
          <button
            onClick={endCall}
            className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition"
            title="End Call"
          >
            <FaPhoneSlash size={28} />
          </button>
        </div>
      )}
    </div>
  );
}
