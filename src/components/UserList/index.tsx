"use client";
import { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

// Props interface for all required state and functions
interface UserListProps {
  users: any[];
  loading: boolean;
  error: string | null;
  isLoading: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  callingUserId: string | null;
  callActive: boolean;
  callAnswered: boolean;
  startCall: (targetClerkId: string, targetUsername: string) => void;
  endCallByCaller: (offerData: { senderId: string; offer: RTCSessionDescriptionInit }) => void;
  clerkId: string | null;
}

export default function UserList(props: UserListProps) {
  const {
    users,
    loading,
    error,
    isLoading,
    localVideoRef,
    callingUserId,
    callAnswered,
  } = props;

  const [open, setOpen] = useState(true);

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="w-full">
      <button
        className="flex items-center justify-between w-full px-4 py-3 bg-white border-b border-gray-200 focus:outline-none"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="userlist-panel"
      >
        <span className="text-xl font-semibold text-left">
          Users in the System
        </span>
        {open ? <FaChevronUp className="ml-2" /> : <FaChevronDown className="ml-2" />}
      </button>
      <div
        id="userlist-panel"
        className={`transition-all duration-300 overflow-hidden ${
          open ? "max-h-[1000px]" : "max-h-0"
        }`}
      >
        {open && (
          <div className="flex flex-col gap-4 w-full px-2 py-2 md:px-4">
            {users.map((user, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white shadow-md rounded-lg border border-gray-300 w-full"
              >
                <div className="flex flex-col items-start mb-2 sm:mb-0">
                  <p className="font-semibold text-lg break-words">{user.username}</p>
                  <p className="text-sm text-gray-600 break-all">{user.email}</p>
                </div>
                <div className="flex flex-row gap-2 w-full sm:w-auto">
                  {/* Show End Call button only if call offer has been sent but NOT answered/connected */}
                  {callingUserId === user.clerkId && !callAnswered ? (
                    <button
                      onClick={() =>
                        // Pass the offer data (senderId and offer) to endCallByCaller
                        props.endCallByCaller({
                          senderId: props.clerkId!,
                          offer: user.offer, // Make sure user.offer is available in your user object
                        })
                      }
                      className="w-full sm:w-auto px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                      disabled={isLoading}
                    >
                      End Call
                    </button>
                  ) : (
                    <button
                      onClick={() => props.startCall(user.clerkId, user.username)}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                      disabled={isLoading || !!callingUserId}
                    >
                      Call
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* Optionally show local video preview */}
            <video ref={localVideoRef} autoPlay muted className="hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
