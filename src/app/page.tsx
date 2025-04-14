"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";
import { v4 as uuidv4 } from "uuid"; // Import UUID for unique client ID

export default function Home() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [iceCandidateQueue, setIceCandidateQueue] = useState<RTCIceCandidateInit[]>([]);
  const [pendingAnswer, setPendingAnswer] = useState<RTCSessionDescriptionInit | null>(null); // Store pending answer
  const [incomingOffers, setIncomingOffers] = useState<{ senderId: string; offer: RTCSessionDescriptionInit }[]>([]); // Track incoming offers
  const [hasAcceptedOffer, setHasAcceptedOffer] = useState(false); // Prevent further offers after accepting one
  const clientId = useRef(uuidv4()); // Generate a unique client ID

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true, // Ensure TLS is enabled
    });

    // Debugging Pusher connection
    pusher.connection.bind("error", (err: any) => {
      console.error("Pusher connection error:", err);
    });

    // Subscribe to the correct channel
    const channel = pusher.subscribe("webrtc-vchat");

    channel.bind("offer", (data: any) => {
      if (data.senderId === clientId.current || hasAcceptedOffer) return; // Ignore own offer or if already accepted an offer
      console.log("Offer received:", data.offer); // Debug log for received offer
      setIncomingOffers((prevOffers) => [...prevOffers, { senderId: data.senderId, offer: data.offer }]);
    });

    channel.bind("answer", async (data: any) => {
      if (data.senderId === clientId.current) return; // Ignore own answer
      console.log("Answer received:", data.answer); // Debug log for received answer
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log("Remote description set with answer");
      } else {
        setPendingAnswer(data.answer); // Queue the answer if peerConnection is not ready
        console.log("Answer queued");
      }
    });

    channel.bind("ice-candidate", async (data: any) => {
      if (data.senderId === clientId.current) return; // Ignore own ICE candidates
      if (peerConnection?.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        setIceCandidateQueue((prevQueue) => [...prevQueue, data.candidate]);
      }
    });

    return () => {
      pusher.unsubscribe("webrtc-vchat");
    };
  }, [peerConnection, pendingAnswer, hasAcceptedOffer]);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log("Track received:", event.streams[0]); // Debug log for received track
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]; // Set the remote stream to the video element
        console.log("Remote video stream set");
      }
    };

    // Handle queued ICE candidates after setting the remote description
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        console.log("Peer connection established");
        iceCandidateQueue.forEach(async (candidate) => {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        });
        setIceCandidateQueue([]); // Clear the queue after processing
      }
    };

    return pc;
  };

  const sendSignal = (type: string, payload: any) => {
    fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, senderId: clientId.current, ...payload }), // Include senderId
    });
  };

  const startCall = async () => {
    if (hasAcceptedOffer) {
      alert("You cannot start a new call after accepting an offer.");
      return;
    }

    try {
      const pc = createPeerConnection();
      setPeerConnection(pc);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log("Local stream obtained:", stream); // Debug log for local stream

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      console.log("Tracks added to peer connection");

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream; // Set the local stream to the video element
        console.log("Local video stream set");
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("Offer created and local description set");

      sendSignal("offer", { offer });
      console.log("Offer sent");
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

  const acceptOffer = async (offerData: { senderId: string; offer: RTCSessionDescriptionInit }) => {
    try {
      const pc = createPeerConnection();
      setPeerConnection(pc);

      // Get the remote client's media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log("Remote client's local stream obtained:", stream); // Debug log for local stream

      // Add the remote client's tracks to the peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      console.log("Remote client's tracks added to peer connection");

      // Set the local video feed for the remote client
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("Remote client's local video stream set");
      }

      // Set the offer as the remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
      console.log("Remote description set with offer");

      // Create and send the answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("Answer created and local description set");

      sendSignal("answer", { answer });
      console.log("Answer sent");

      // Remove the accepted offer from the list
      setIncomingOffers((prevOffers) => prevOffers.filter((offer) => offer.senderId !== offerData.senderId));
      setHasAcceptedOffer(true); // Mark that an offer has been accepted
    } catch (error) {
      console.error("Error accepting offer:", error);
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
      <div className="incoming-offers mt-4">
        <h2 className="text-xl font-bold">Incoming Offers</h2>
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
    </div>
  );
}
