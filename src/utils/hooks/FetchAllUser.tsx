import { useEffect, useState } from "react";
import { getAllUsers } from "../../lib/actions/user.actions";
import { toast } from "react-toastify";

export interface User {
  username: string;
  email: string;
  clerkId: string;
}

export function useFetchAllUsers(currentUserId: string | null) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!currentUserId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const allUsers = await getAllUsers();
        if (!isMounted) return;
        const filteredUsers = allUsers.filter((user: User) => user.clerkId !== currentUserId);
        setUsers(filteredUsers);
        setError(null);
      } catch (err: any) {
        if (!isMounted) return;
        setError("Failed to fetch users. Please try again later.");
        toast.error("Failed to fetch users. Please try again later.");
        setUsers([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  return { users, loading, error };
}