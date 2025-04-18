"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUp,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function RegisterComponent() {
  return (
    <div className="w-full h-screen flex flex-col justify-center items-center">
      {/* <SignedOut>
        <SignInButton />
        <SignUpButton />
      </SignedOut> */}
      <SignUp
        path="/pages/auth/register"
        routing="path"
        signInUrl="/pages/auth/register"
      />
    </div>
  );
}
