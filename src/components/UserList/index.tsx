"use client";

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

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="flex flex-col gap-4 w-full">
      {users.map((user, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-4 bg-white shadow-md rounded-lg border border-gray-300"
        >
          <div className="flex flex-col items-start">
            <p className="font-semibold text-lg">{user.username}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
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
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              disabled={isLoading}
            >
              End Call
            </button>
          ) : (
            <button
              onClick={() => props.startCall(user.clerkId, user.username)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={isLoading || !!callingUserId}
            >
              Call
            </button>
          )}
        </div>
      ))}
      {/* Optionally show local video preview */}
      <video ref={localVideoRef} autoPlay muted className="hidden" />
    </div>
  );
}
