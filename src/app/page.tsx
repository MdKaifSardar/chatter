"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";

export default function Home() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [iceCandidateQueue, setIceCandidateQueue] = useState<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe("video-chat");
    channel.bind("offer", async (data: any) => {
      if (!peerConnection) {
        const pc = new RTCPeerConnection();
        setPeerConnection(pc);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignal("ice-candidate", { candidate: event.candidate });
          }
        };

        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Process queued ICE candidates
        iceCandidateQueue.forEach(async (candidate) => {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        });
        setIceCandidateQueue([]);

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal("answer", { answer });
      }
    });

    channel.bind("answer", async (data: any) => {
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    channel.bind("ice-candidate", async (data: any) => {
      if (peerConnection?.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        // Queue the ICE candidate if remote description is not set
        setIceCandidateQueue((prevQueue) => [...prevQueue, data.candidate]);
      }
    });

    return () => {
      pusher.unsubscribe("video-chat");
    };
  }, [peerConnection, iceCandidateQueue]);

  const sendSignal = (type: string, payload: any) => {
    fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
  };

  const startCall = async () => {
    try {
      const pc = new RTCPeerConnection();
      setPeerConnection(pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("ice-candidate", { candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Request access to the user's media devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Add tracks to the peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Set the local video stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create and send an offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal("offer", { offer });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          alert("Permission to access media devices was denied.");
        } else if (error.name === "NotReadableError") {
          alert("The device is already in use. Please close other applications or tabs using the device.");
        } else {
          console.error("Error accessing media devices:", error);
        }
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Video Chat</h1>
      <div className="video-chat flex flex-col items-center gap-4">
        <video ref={localVideoRef} autoPlay muted className="w-64 h-48 bg-black" />
        <video ref={remoteVideoRef} autoPlay className="w-64 h-48 bg-black" />
        <button
          onClick={startCall}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Start Call
        </button>
      </div>
    </div>
  );
}
