"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Pusher from "pusher-js";
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
} from "react-icons/fa";
import { toast } from "react-toastify";
import Loader from "../Loader";

export default function VideoChatComp() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [iceCandidateQueue, setIceCandidateQueue] = useState<
    RTCIceCandidateInit[]
  >([]);
  const [incomingOffers, setIncomingOffers] = useState<
    { senderId: string; offer: RTCSessionDescriptionInit }[]
  >([]);
  const [hasAcceptedOffer, setHasAcceptedOffer] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { userId: clerkId } = useAuth(); // Get the Clerk user ID

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "ef78J8TSYT38TYRLSL",
          credential: "41sxU7kc8Lwyv5yQ",
        },
      ],
    });

    const remoteStream = new MediaStream();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteStream.addTrack(event.track);
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        remoteVideoRef.current.play().catch((error) => {
          toast.error("Failed to play remote video stream.");
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected") {
        pc.restartIce();
        toast.info("Attempting to restart ICE...");
      }
    };

    return pc;
  };

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });

    const channel = pusher.subscribe("webrtc-vchat");

    channel.bind("offer", (data: any) => {
      if (data.senderId === clerkId || hasAcceptedOffer) return;
      setIncomingOffers((prevOffers) => [
        ...prevOffers,
        { senderId: data.senderId, offer: data.offer },
      ]);
    });

    channel.bind("answer", async (data: any) => {
      if (data.senderId === clerkId) return;
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch {
          toast.error("Failed to set remote description for answer.");
        }
      }
    });

    channel.bind("ice-candidate", async (data: any) => {
      if (data.senderId === clerkId) return;
      if (peerConnection?.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch {
          toast.error("Failed to add ICE candidate.");
        }
      } else {
        setIceCandidateQueue((prevQueue) => [...prevQueue, data.candidate]);
      }
    });

    return () => {
      pusher.unsubscribe("webrtc-vchat");
    };
  }, [peerConnection, hasAcceptedOffer, clerkId]);

  useEffect(() => {
    if (peerConnection && peerConnection.remoteDescription) {
      iceCandidateQueue.forEach(async (candidate) => {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          toast.error("Error adding queued ICE candidate.");
        }
      });
      setIceCandidateQueue([]);
    }
  }, [peerConnection, peerConnection?.remoteDescription]);

  const sendSignal = (type: string, payload: any) => {
    fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, senderId: clerkId, ...payload }),
    }).catch(() => toast.error("Failed to send signal."));
  };

  const startCall = async () => {
    if (hasAcceptedOffer) {
      toast.error("You cannot start a new call after accepting an offer.");
      return;
    }

    setIsLoading(true);
    try {
      const pc = createPeerConnection();
      setPeerConnection(pc);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {
          toast.error("Failed to play local video stream.");
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal("offer", { offer });
    } catch {
      toast.error("Failed to start the call.");
    } finally {
      setIsLoading(false);
    }
  };

  const acceptOffer = async (offerData: { senderId: string; offer: RTCSessionDescriptionInit }) => {
    setIsLoading(true);
    try {
      const pc = createPeerConnection();
      setPeerConnection(pc);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal("answer", { answer });
      setIncomingOffers([]);
      setHasAcceptedOffer(true);
    } catch {
      toast.error("Failed to accept the offer.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => (track.enabled = !isVideoEnabled));
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => (track.enabled = !isMicEnabled));
      setIsMicEnabled(!isMicEnabled);
    }
  };

  const endCall = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    sendSignal("user-left", { senderId: clerkId });
    setHasAcceptedOffer(false);
    setCallStatus(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
      {isLoading && <Loader />}
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
      <div className="absolute bottom-4 flex gap-4">
        {!peerConnection && !hasAcceptedOffer && (
          <button onClick={startCall} className="px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-400">
            Start Call
          </button>
        )}
        {(peerConnection || hasAcceptedOffer) && (
          <>
            <button onClick={toggleVideo} className="px-4 py-2 bg-gray-800 rounded-full hover:bg-gray-700">
              {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
            </button>
            <button onClick={toggleMic} className="px-4 py-2 bg-gray-800 rounded-full hover:bg-gray-700">
              {isMicEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </button>
            <button onClick={endCall} className="px-4 py-2 bg-red-600 rounded-full hover:bg-red-500">
              <FaPhoneSlash />
            </button>
          </>
        )}
      </div>
      {!peerConnection && !hasAcceptedOffer && (
        <div className="incoming-offers mt-4 z-[100]">
          {incomingOffers.map((offer) => (
            <div key={offer.senderId} className="offer-item flex items-center gap-2 mt-2">
              <span>Offer from {offer.senderId}</span>
              <button
                onClick={() => acceptOffer(offer)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Receive Offer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
