"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";
import { v4 as uuidv4 } from "uuid";
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../components/Loader";

export default function Home() {
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
  const [remoteUserLeft, setRemoteUserLeft] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loader state
  const clientId = useRef(uuidv4());

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(
      // {
      //   iceServers: [
      //     {
      //       urls: "stun:stun.l.google.com:19302", // Google's public STUN server
      //     },
      //     {
      //       urls: "stun:stun1.l.google.com:19302", // Additional Google STUN server
      //     },
      //     {
      //       urls: "stun:stun2.l.google.com:19302", // Additional Google STUN server
      //     },
      //     {
      //       urls: "stun:stun3.l.google.com:19302", // Additional Google STUN server
      //     },
      //     {
      //       urls: "stun:stun4.l.google.com:19302", // Additional Google STUN server
      //     },
      //     {
      //       urls: "turn:relay1.expressturn.com:3478", // Replace with your TURN server URL
      //       username: "ef78J8TSYT38TYRLSL", // Replace with your TURN server username
      //       credential: "41sxU7kc8Lwyv5yQ", // Replace with your TURN server credential
      //     },
      //   ],
      // }
    );

    // const remoteStream = new MediaStream(); // Create a MediaStream for remote tracks

    // pc.onicecandidate = (event) => {
    //   if (event.candidate) {
    //     sendSignal("ice-candidate", { candidate: event.candidate });
    //   }
    // };

    // pc.ontrack = (event) => {
    //   console.log("Track received:", event.track.kind); // Debug log for received track type
    //   if (remoteVideoRef.current) {
    //     try {
    //       // Add the track to the remote MediaStream
    //       remoteStream.addTrack(event.track);

    //       // Assign the MediaStream to the video element only once
    //       if (remoteVideoRef.current.srcObject !== remoteStream) {
    //         remoteVideoRef.current.srcObject = remoteStream;
    //         console.log("Remote video and audio stream set successfully");
    //       }

    //       // Ensure the video plays
    //       remoteVideoRef.current
    //         .play()
    //         .then(() => console.log("Remote video stream playing"))
    //         .catch((error) => {
    //           console.error("Error playing remote video stream:", error);
    //           toast.error("Failed to play remote video stream.");
    //         });
    //     } catch (error) {
    //       console.error("Error setting remote video stream:", error);
    //       toast.error("Failed to display remote video stream.");
    //     }
    //   }
    // };

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

    // pc.onconnectionstatechange = () => {
    //   console.log("Connection state changed:", pc.connectionState);
    //   if (
    //     pc.connectionState === "disconnected" ||
    //     pc.connectionState === "failed"
    //   ) {
    //     console.error("Connection state is disconnected");
    //   }
    // };

    // pc.oniceconnectionstatechange = () => {
    //   console.log("ICE connection state changed:", pc.iceConnectionState);
    //   if (pc.iceConnectionState === "disconnected") {
    //     console.warn(
    //       "ICE connection failed. Retrying ICE candidate exchange..."
    //     );

    //     // Attempt to restart ICE
    //     pc.restartIce();
    //     toast.info("Attempting to restart ICE...");
    //   }
    // };

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

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });

    const channel = pusher.subscribe("webrtc-vchat");

    channel.bind("offer", (data: any) => {
      if (data.senderId === clientId.current || hasAcceptedOffer) return;
      setIncomingOffers((prevOffers) => [
        ...prevOffers,
        { senderId: data.senderId, offer: data.offer },
      ]);
    });

    channel.bind("answer", async (data: any) => {
      if (data.senderId === clientId.current) return;
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch (error) {
          toast.error("Failed to set remote description for answer.");
        }
      }
    });

    channel.bind("ice-candidate", async (data: any) => {
      if (data.senderId === clientId.current) return;
      if (peerConnection?.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          toast.error("Failed to add ICE candidate.");
        }
      } else {
        setIceCandidateQueue((prevQueue) => [...prevQueue, data.candidate]);
      }
    });

    channel.bind("user-left", (data: any) => {
      if (data.senderId !== clientId.current) {
        console.log(`User ${data.senderId} has left the call.`);
      }
    });

    channel.bind("connection-failed", (data: any) => {
      if (data.senderId !== clientId.current) {
        console.error(
          "Peer connection failed or disconnected by the other user."
        );
        toast.error("The other user's connection failed or disconnected.");
        setCallStatus("The other user's connection failed or disconnected.");
        setTimeout(() => setCallStatus(null), 5000);
        // Do not end the call for the current user
      }
    });

    return () => {
      pusher.unsubscribe("webrtc-vchat");
    };
  }, [peerConnection, hasAcceptedOffer]);

  const sendSignal = (type: string, payload: any) => {
    fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, senderId: clientId.current, ...payload }),
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
        video: true, // Use "user" for front camera on mobile
        audio: true,
      });

      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch((error) => {
          console.error("Error playing local video stream:", error);
          toast.error("Failed to play local video stream.");
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("Offer created and set as local description:", offer); // Debug log for offer
      sendSignal("offer", { offer });
    } catch (error) {
      console.error("Error starting the call:", error);
      toast.error(
        "Failed to start the call. Please check your TURN server or network."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // const acceptOffer = async (offerData: {
  //   senderId: string;
  //   offer: RTCSessionDescriptionInit;
  // }) => {
  //   setIsLoading(true);
  //   try {
  //     const pc = createPeerConnection();
  //     setPeerConnection(pc);

  //     const stream = await navigator.mediaDevices.getUserMedia({
  //       video: true,
  //       audio: true,
  //     });

  //     setLocalStream(stream);
  //     stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  //     if (localVideoRef.current) {
  //       localVideoRef.current.srcObject = stream;
  //       localVideoRef.current.muted = true;
  //     }

  //     await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
  //     console.log("Remote description set with offer:", offerData.offer); // Debug log for remote description

  //     const answer = await pc.createAnswer();
  //     await pc.setLocalDescription(answer);

  //     console.log("Answer created and set as local description:", answer); // Debug log for answer
  //     sendSignal("answer", { answer });
  //     setIncomingOffers([]);
  //     setHasAcceptedOffer(true);
  //   } catch (error) {
  //     console.error("Error accepting the offer:", error);
  //     toast.error(
  //       "Failed to accept the offer. Please check your TURN server or network."
  //     );
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

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

  const toggleVideo = () => {
    if (localStream) {
      localStream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !isVideoEnabled));
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMicEnabled;
        console.log(`Mic is now ${track.enabled ? "enabled" : "disabled"}`);
      });
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
    sendSignal("user-left", { senderId: clientId.current }); // Notify the other user
    setHasAcceptedOffer(false);
    setCallStatus(null);
  };

  return (
    <>
      <ToastContainer />
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
        {isLoading && <Loader />}
        <video
          ref={remoteVideoRef}
          autoPlay
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
        <div className="absolute top-4 left-4 w-48 h-36 bg-black border border-gray-700 rounded-lg overflow-hidden md:w-64 md:h-48">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            className="w-full h-full object-contain"
          />
        </div>
        <div className="absolute bottom-4 flex gap-4">
          {!peerConnection && !hasAcceptedOffer && (
            <button
              onClick={startCall}
              className="px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-400"
            >
              Start Call
            </button>
          )}
          {(peerConnection || hasAcceptedOffer) && (
            <>
              <button
                onClick={toggleVideo}
                className="px-4 py-2 bg-gray-800 rounded-full hover:bg-gray-700"
              >
                {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
              </button>
              <button
                onClick={toggleMic}
                className="px-4 py-2 bg-gray-800 rounded-full hover:bg-gray-700"
              >
                {isMicEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </button>
              <button
                onClick={endCall}
                className="px-4 py-2 bg-red-600 rounded-full hover:bg-red-500"
              >
                <FaPhoneSlash />
              </button>
            </>
          )}
        </div>
        {!peerConnection && !hasAcceptedOffer && (
          <div className="incoming-offers mt-4 z-[100]">
            {incomingOffers.map((offer) => (
              <div
                key={offer.senderId}
                className="offer-item flex items-center gap-2 mt-2"
              >
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
    </>
  );
}
