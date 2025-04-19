"use client";

import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between p-4 bg-gray-800 text-white">
      <div>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
      <div>
        <SignedOut>
          <Link href="/pages/auth/register">
            <button className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">
              Register
            </button>
          </Link>
        </SignedOut>
      </div>
    </nav>
  );
}
