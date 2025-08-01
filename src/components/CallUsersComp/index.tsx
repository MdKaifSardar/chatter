"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { getAllUsers, getUserByClerkId } from "../../lib/actions/user.actions";
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
  const [isCallerStartingCall, setIsCallerStartingCall] = useState(false);

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
    setIsCallerStartingCall(true); // Hide lists for caller immediately
    try {
      // Fetch the caller's username using their clerkId
      let senderUsername: string | null = null;
      try {
        const user = await getUserByClerkId(clerkId as string);
        if (user && user.username) {
          senderUsername = user.username;
        }
      } catch (e) {
        senderUsername = clerkId ?? "Unknown";
      }

      const pc = createPeerConnection();
      setPeerConnection(pc);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Set and play local video immediately after getting stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        let tries = 0;
        const tryPlay = () => {
          if (!localVideoRef.current) return;
          localVideoRef.current
            .play()
            .catch(() => {
              tries++;
              if (tries < 10) setTimeout(tryPlay, 100);
            });
        };
        tryPlay();
      }

      // --- Ensure the local video feed is set before proceeding ---
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        // Wait for the video element to be ready and playing
        let tries = 0;
        while (
          localVideoRef.current.srcObject !== stream ||
          localVideoRef.current.readyState < 2 // HAVE_CURRENT_DATA
        ) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((res) => setTimeout(res, 50));
          tries++;
          if (tries > 20) break; // Wait up to ~1s
        }
        try {
          await localVideoRef.current.play();
        } catch (error) {
          console.error("Error playing local video stream:", error);
          toast.error("Failed to play local video stream.");
        }
      }
      // -----------------------------------------------------------

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("Offer created and set as local description:", offer); // Debug log for offer
      sendSignal("call-request", {
        offer,
        receiverId: targetClerkId,
        receiverUsername: targetUsername,
        senderUsername: senderUsername ?? clerkId,
        senderId: clerkId,
      });
      toast.success(`Calling ${targetUsername}...`);
    } catch (err) {
      toast.error("Failed to start the call: " + (err as Error).message);
      console.error("Start call error:", err);
      setIsCallerStartingCall(false); // Reset if call fails
    } finally {
      setIsLoading(false);
    }
  };

  // Reset isCallerStartingCall when call ends or is cancelled/rejected
  useEffect(() => {
    if (!callingUserId && isCallerStartingCall) {
      setIsCallerStartingCall(false);
    }
  }, [callingUserId, isCallerStartingCall]);

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

  // Send a signal to the other user that the call was rejected and remove from state/storage
  const rejectCall = (call: { senderId: string; offer: RTCSessionDescriptionInit }) => {
    // Notify remote user
    sendSignal("call-rejected", {
      senderId: clerkId,
      receiverId: call.senderId,
      offer: call.offer,
    });
    // Remove from local state and storage
    removeOfferFromStorageAndState(call);
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
    setRemoteStream(remoteStream); // <-- ensure remoteStream state is set

    pc.ontrack = (event) => {
      // Only handle remote video if the video chat is active and the ref is present
      if (showVideoChat && remoteVideoRef.current) {
        try {
          if (remoteStream) {
            remoteStream.addTrack(event.track);
          } else {
            console.error("remoteStream is null when receiving remote track.");
            toast.error("Remote stream is not initialized.");
            return;
          }
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            if (remoteVideoRef.current.srcObject === remoteStream) {
              console.log("Remote video and audio stream set successfully");
            } else {
              console.error("Failed to set remote video element srcObject.");
              toast.error("Failed to set remote video element srcObject.");
            }
          }
          if (remoteStream.getTracks().length === 0) {
            console.warn("Remote stream srcObject set but has no tracks.");
            toast.warn("Remote stream has no tracks.");
          }
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
        // If not ready, just add the track to the remoteStream, UI will handle rendering
        if (remoteStream) {
          remoteStream.addTrack(event.track);
        }
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
        // Only process if this client is the intended receiver
        if (data.receiverId !== clerkId) return;
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

  // Listen for call-rejected signal and end call if received
  useEffect(() => {
    if (!peerConnection && !callingUserId) return;

    const clientId = { current: clerkId };
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });
    const channel = pusher.subscribe("webrtc-vchat");

    const handleCallRejected = (data: any) => {
      // Only act if this client is the caller and the call was rejected
      if (data.receiverId === clientId.current) {
        toast.info("Call was rejected by the other user.");
        stopMediaAndCleanup();
      }
    };

    channel.bind("call-rejected", handleCallRejected);

    return () => {
      channel.unbind("call-rejected", handleCallRejected);
      channel.unsubscribe();
      if (pusher.connection.state === "connected") {
        pusher.disconnect();
      }
    };
  }, [peerConnection, callingUserId, clerkId]);

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
      setIsCallerStartingCall(false);
    } catch (err) {
      toast.error("Error during cleanup.");
    }
  };

  // End call for both clients (local user)
  const endCall = async () => {
    try {
      if (callingUserId) {
        sendSignal("call-ended", { receiverId: callingUserId });
      }
      // Clear local video element srcObject immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      await stopMediaAndCleanup();
      // DO NOT clear incomingCalls or offers here!
      // Only end the current call, do not affect other incoming calls
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
      // Clear local video element srcObject immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
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
    rejectCall, // use the new rejectCall function
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

  // For the callee, showVideoChat is set to true only after answer is received
  // For the caller, hide lists as soon as startCall is invoked (isCallerStartingCall)
  const shouldShowVideoChat = showVideoChat || isCallerStartingCall;

  return (
    <div className="mt-[4rem] flex flex-col md:flex-row items-start justify-center w-full h-fit">
      {/* Left side: UserList and CallList as their own accordions */}
      {!shouldShowVideoChat && (
        <div className="flex flex-col items-center justify-center w-full md:w-1/2 max-w-2xl">
          <div className="w-full md:w-[32rem]">
            <UserList {...userListProps} />
            <CallList {...callListProps} />
          </div>
        </div>
      )}
      {/* Right side: VideoChatCompNew - only rendered when call is started */}
      <div
        className={`bg-yellow-400 w-full md:w-1/2 lg:w-2/3 min-h-[300px] flex items-center justify-center transition-all duration-300 ${
          shouldShowVideoChat ? "block" : "hidden"
        }`}
      >
        {shouldShowVideoChat && (
          <VideoChatCompNew
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            localStream={localStream}
            remoteStream={remoteStream}
            peerConnection={peerConnection}
            endCall={endCall}
            // Add any other props you need to pass
          />
        )}
      </div>
    </div>
  );
}