import { SignedIn, UserButton } from "@clerk/nextjs";
import React from "react";

const page = () => {
  return (
    <div className="w-full h-full">
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
};

export default page;
