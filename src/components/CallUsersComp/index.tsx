"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { getAllUsers } from "../../lib/actions/user.actions";
import { useAuth } from "@clerk/nextjs";
import Loader from "../Loader";
import { useRouter } from "next/navigation";
import UserList from "../UserList";
import CallList from "../CallList";
import VideoChatCompNew from "../VideoChatCompNew";
import Pusher, { Channel } from "pusher-js";
import { useFetchIncomingCalls } from "../../utils/hooks/FetchIncomingCalls";
import { useFetchAllUsers } from "../../utils/hooks/FetchAllUser";

export default function CallUsersComp() {
  const { userId: clerkId } = useAuth();
  const router = useRouter();

  // UserList state
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(
    null
  ) as React.RefObject<HTMLVideoElement>;
  const remoteVideoRef = useRef<HTMLVideoElement>(
    null
  ) as React.RefObject<HTMLVideoElement>;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callingUserId, setCallingUserId] = useState<string | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [callAnswered, setCallAnswered] = useState(false);
  const [showVideoChat, setShowVideoChat] = useState(false);
  // Add a trigger state for call cancelled
  // const [callCancelledTrigger, setCallCancelledTrigger] = useState<null | any>(
  //   null
  // );

  // CallList state
  const [callPeerConnection, setCallPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [callLocalStream, setCallLocalStream] = useState<MediaStream | null>(
    null
  );
  const callLocalVideoRef = useRef<HTMLVideoElement>(
    null
  ) as React.RefObject<HTMLVideoElement>;
  const [callIsLoading, setCallIsLoading] = useState(false);
  // State for tracking if the current call was cancelled
  // Video chat signaling state
  const [channel, setChannel] = useState<Channel | null>(null);
  const [pusher, setPusher] = useState<Pusher | null>(null);
  const LOCAL_STORAGE_KEY = "incomingCalls";
  // State for incoming calls, always set from the hook
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const fetchedIncomingCalls = useFetchIncomingCalls(clerkId || null);
  // Fetch users only once and reuse the result
  const {
    users,
    loading: usersLoading,
    error: usersError,
  } = useFetchAllUsers(clerkId || null);
  // Helper to send signaling messages
  const sendSignal = (type: string, payload: any) => {
    console.log("Sending signal:", type, payload); // Debug log
    fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
  };
  // UserList logic
  const startCall = async (targetClerkId: string, targetUsername: string) => {
    setIsLoading(true);
    setCallingUserId(targetClerkId);
    setCallAnswered(false);
    setCallActive(false);
    try {
      const pc = createPeerConnection();
      setPeerConnection(pc);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Use "user" for front camera on mobile
          width: { ideal: 1280 }, // Higher resolution width
          height: { ideal: 720 }, // Higher resolution height
          frameRate: { ideal: 30 }, // Higher frame rate
        },
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
      sendSignal("call-request", {
        offer,
        receiverId: targetClerkId,
        receiverUsername: targetUsername,
        senderUsername: clerkId,
        senderId: clerkId,
      });
      toast.success(`Calling ${targetUsername}...`);
    } catch (err) {
      toast.error("Failed to start the call: " + (err as Error).message);
      console.error("Start call error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state with hook result on every reload and when offers change
  useEffect(() => {
    setIncomingCalls(fetchedIncomingCalls);
  }, [JSON.stringify(fetchedIncomingCalls)]);

  // Remove a specific offer from localStorage and update state
  const removeOfferFromStorageAndState = (call: any) => {
    setIncomingCalls((calls) => {
      const updated = calls.filter(
        (c) =>
          !(c.senderId === call.senderId && c.offer?.sdp === call.offer?.sdp)
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Accept offer (callee side)
  const acceptOffer = async (call: {
    senderId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    setCallIsLoading(true);
    try {
      removeOfferFromStorageAndState(call);
      const pc = createPeerConnection();
      setCallPeerConnection(pc);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setCallLocalStream(stream);
      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
      console.log("Remote description set with offer:", call.offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("Answer created and set as local description:", answer);

      sendSignal("answer", { answer, receiverId: call.senderId });
      setPeerConnection(pc);
      setShowVideoChat(true);
      setCallAnswered(true);
      setCallActive(true);
      setCallingUserId(call.senderId);
    } catch (err) {
      toast.error("Failed to accept the offer: " + (err as Error).message);
      console.error("Accept offer error:", err);
    } finally {
      setCallIsLoading(false);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "ef78J8TSYT38TYRLSL",
          credential: "41sxU7kc8Lwyv5yQ",
        },
      ],
    });

    // Always use a new MediaStream for remote tracks
    const remoteStream = new MediaStream();
    // setRemoteStream(remoteStreamObj);

    pc.ontrack = (event) => {
      console.log("Track received:", event.track.kind); // Debug log for received track type
      if (remoteVideoRef.current) {
        try {
          // Add the track to the remote MediaStream
          if (remoteStream) {
            remoteStream.addTrack(event.track);
          } else {
            console.error("remoteStream is null when receiving remote track.");
            toast.error("Remote stream is not initialized.");
            return;
          }

          // Assign the MediaStream to the video element only once
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            if (remoteVideoRef.current.srcObject === remoteStream) {
              console.log("Remote video and audio stream set successfully");
            } else {
              console.error("Failed to set remote video element srcObject.");
              toast.error("Failed to set remote video element srcObject.");
            }
          } else {
            // Already set, but check if tracks are present
            if (remoteStream.getTracks().length === 0) {
              console.warn("Remote stream srcObject set but has no tracks.");
              toast.warn("Remote stream has no tracks.");
            }
          }

          // Ensure the video plays
          remoteVideoRef.current
            .play()
            .then(() => console.log("Remote video stream playing"))
            .catch((error) => {
              console.error("Error playing remote video stream:", error);
              toast.error("Failed to play remote video stream.");
            });
        } catch (error) {
          console.error("Error setting remote video stream:", error);
          toast.error("Failed to display remote video stream.");
        }
      } else {
        console.error("remoteVideoRef.current is null in ontrack handler.");
        toast.error("Remote video element not found.");
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state changed:", pc.connectionState);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        console.error("Connection state is disconnected or failed");
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state changed:", pc.iceConnectionState);
      if (pc.iceConnectionState === "disconnected") {
        console.warn(
          "ICE connection failed. Retrying ICE candidate exchange..."
        );

        // Attempt to restart ICE
        pc.restartIce();
        toast.info("Attempting to restart ICE...");
      }
    };

    setPeerConnection(pc);
    return pc;
  };

  // Replace separate answer and ice-candidate listeners with a single useEffect
  useEffect(
    () => {
      if (!peerConnection || !callingUserId) return;

      const clientId = { current: clerkId };
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        forceTLS: true,
      });
      const channel = pusher.subscribe("webrtc-vchat");

      const iceCandidateQueueRef = { current: [] as any[] };

      // Answer event
      const handleAnswer = async (data: any) => {
        if (data.senderId === clientId.current) return;
        if (peerConnection) {
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            // After setting remote description, flush queued ICE candidates
            for (const candidate of iceCandidateQueueRef.current) {
              try {
                await peerConnection.addIceCandidate(
                  new RTCIceCandidate(candidate)
                );
              } catch (error) {
                toast.error("Failed to add queued ICE candidate.");
              }
            }
            iceCandidateQueueRef.current = [];
            setShowVideoChat(true); // <-- Ensure caller also hides lists on answer
            setCallActive(true);
            setCallAnswered(true);
          } catch (error) {
            toast.error("Failed to set remote description for answer.");
          }
        }
      };

      // ICE candidate event
      const handleIceCandidate = async (data: any) => {
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
          iceCandidateQueueRef.current.push(data.candidate);
        }
      };

      const handleCallCancelled = async (data: any) => {
        if (data.senderId === clientId.current) return;
        toast.info("Call cancelled by caller.");
        setCallingUserId(null);
        setCallActive(false);
        setCallAnswered(false);
        setShowVideoChat(false);
        removeOfferFromStorageAndState(data);
      };

      // Call-ended event
      const handleCallEnded = (data: any) => {
        if (data.senderId === clientId.current) return;
        toast.info("The other user ended the call.");
        // Stop all media and cleanup for the remote user as well
        stopMediaAndCleanup();
      };

      channel.bind("answer", handleAnswer);
      channel.bind("ice-candidate", handleIceCandidate);
      channel.bind("call-ended", handleCallEnded);
      channel.bind("call-cancelled", handleCallCancelled);

      return () => {
        channel.unbind("answer", handleAnswer);
        channel.unbind("ice-candidate", handleIceCandidate);
        channel.unbind("call-ended", handleCallEnded);
        channel.unbind("call-cancelled", handleCallCancelled);
        channel.unsubscribe();
        if (pusher.connection.state === "connected") {
          pusher.disconnect();
        }
      };
    },
    [
      peerConnection,
      callingUserId,
      clerkId,
      localStream,
    ]
  );

  // Stop all media and cleanup function (for both local and remote user)
  const stopMediaAndCleanup = async () => {
    try {
      // Stop and clear local video
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const tracks = (
          localVideoRef.current.srcObject as MediaStream
        ).getTracks();
        tracks.forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        localVideoRef.current.srcObject = null;
      }
      // Stop and clear remote video
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        const tracks = (
          remoteVideoRef.current.srcObject as MediaStream
        ).getTracks();
        tracks.forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        remoteVideoRef.current.srcObject = null;
      }
      // Stop and clear local stream
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        setLocalStream(null);
      }
      // Stop and clear remote stream
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        setRemoteStream(null);
      }
      // Close peer connection
      if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        try {
          peerConnection.close();
        } catch {}
        setPeerConnection(null);
      }
      // Unbind and unsubscribe from channel
      if (channel) {
        try {
          channel.unbind_all();
          channel.unsubscribe();
        } catch {}
      }
      // Disconnect pusher
      if (
        pusher &&
        pusher.connection &&
        pusher.connection.state === "connected"
      ) {
        try {
          pusher.disconnect();
        } catch {}
      }
      setShowVideoChat(false);
      setCallActive(false);
      setCallAnswered(false);
      setCallingUserId(null);
    } catch (err) {
      toast.error("Error during cleanup.");
    }
  };

  // End call for both clients (local user)
  const endCall = async () => {
    try {
      sendSignal("call-ended", {});
      await stopMediaAndCleanup();
    } catch {
      toast.error("Error ending call.");
    }
  };

  // End call by caller before receiver accepts (invalidate offer and stop local media)
  const endCallByCaller = async (offerData: {
    senderId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    try {
      sendSignal("call-cancelled", {
        senderId: offerData.senderId,
        offer: offerData.offer,
      });
      // Stop all local media and cleanup
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const tracks = (
          localVideoRef.current.srcObject as MediaStream
        ).getTracks();
        tracks.forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        localVideoRef.current.srcObject = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        setLocalStream(null);
      }
      setCallingUserId(null);
      setCallActive(false);
      setCallAnswered(false);
      setShowVideoChat(false);
      if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        try {
          peerConnection.close();
        } catch {}
        setPeerConnection(null);
      }
      toast.info("Call cancelled.");
    } catch {
      toast.error("Error cancelling call.");
    }
  };

  // Data for UserList and CallList
  const userListProps = {
    users,
    loading: usersLoading,
    error: usersError,
    isLoading,
    localVideoRef,
    callingUserId,
    callActive,
    callAnswered,
    startCall,
    endCallByCaller,
    clerkId: clerkId ?? null,
  };

  // In the call list props, use the local state
  const callListProps = {
    incomingCalls,
    isLoading: callIsLoading,
    acceptOffer,
    localVideoRef: callLocalVideoRef,
  };

  // Use usersLoading and usersError for loader and error display
  if (usersLoading)
    return (
      <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-black bg-opacity-50 z-50">
        <Loader />
      </div>
    );
  if (usersError) return <div className="text-red-500">{usersError}</div>;

  return (
    <div className="mt-[3.5rem] flex flex-col md:flex-row items-start w-full">
      {/* Left side: UserList and CallList as their own accordions */}
      {!showVideoChat ? (
        <div className="h-fit flex flex-col w-full md:w-1/2 lg:w-1/3">
          <UserList {...userListProps} />
          <CallList {...callListProps} />
        </div>
      ) : null}
      {/* Right side: VideoChatCompNew - always rendered */}
      <div className="bg-yellow-400 w-full md:w-1/2 lg:w-2/3 min-h-[300px] flex items-center justify-center">
        <VideoChatCompNew
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localStream}
          remoteStream={remoteStream}
          peerConnection={peerConnection}
          endCall={endCall}
          // Add any other props you need to pass
        />
      </div>
    </div>
  );
}