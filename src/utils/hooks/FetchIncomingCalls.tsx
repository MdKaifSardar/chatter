import { useEffect, useState } from "react";
import Pusher from "pusher-js";
import { toast } from "react-toastify";

export interface IncomingCall {
  senderUsername: string;
  senderId: string;
  offer: RTCSessionDescriptionInit;
}

const LOCAL_STORAGE_KEY = "incomingCalls";

export function useFetchIncomingCalls(userId: string | null) {
  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([]);

  // Load offers from localStorage
  const loadFromStorage = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  };

  // On mount/load user, set state from localStorage
  useEffect(() => {
    if (!userId) return;
    setIncomingCalls(loadFromStorage());
  }, [userId]);

  // Listen for new offers and add to localStorage if not present
  useEffect(() => {
    if (!userId) return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });
    const channel = pusher.subscribe("webrtc-vchat");
    channel.bind("call-request", (data: any) => {
      if (data.receiverId === userId && data.offer) {
        toast.info(`Incoming call from ${data.senderUsername}`);
        const current = loadFromStorage();
        const exists = current.some(
          (c: IncomingCall) =>
            c.senderId === data.senderId && c.offer?.sdp === data.offer?.sdp
        );
        if (!exists) {
          const updated = [
            ...current,
            {
              senderUsername: data.senderUsername,
              senderId: data.senderId,
              offer: data.offer,
            },
          ];
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          setIncomingCalls(updated);
        } else {
          setIncomingCalls(current);
        }
      }
    });
    return () => {
      pusher.unsubscribe("webrtc-vchat");
    };
  }, [userId]);

  // Always return the offers from localStorage (sync on storage change)
  useEffect(() => {
    const handler = () => setIncomingCalls(loadFromStorage());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return incomingCalls;
}
