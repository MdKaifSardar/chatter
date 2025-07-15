"use client";

import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full flex items-center justify-between p-4 bg-gray-800 text-white z-50">
      <div className="flex items-center gap-4">
        <SignedIn>
          <UserButton />
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <Link href="/pages/video-chat" className="hover:underline">
            Video Call
          </Link>
          <Link href="/pages/call-list" className="hover:underline">
            Call List
          </Link>
        </SignedIn>
        <SignedOut>
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </SignedOut>
      </div>
      <div>
        <SignedOut>
          <Link href="/pages/auth/login" className="hover:underline">
            Login
          </Link>
          <Link href="/pages/auth/register" className="ml-4 hover:underline">
            Register
          </Link>
        </SignedOut>
      </div>
    </nav>
  );
}
