"use client";

import { usePathname } from "next/navigation";
import Navbar from "../Navbar";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isExcludedPage =
    pathname?.startsWith("/pages/auth/register") ||
    pathname?.startsWith("/pages/auth/sign-in") ||
    pathname?.startsWith("/pages/video-chat"); // Exclude Navbar for video-chat page

  return (
    <>
      {!isExcludedPage && <Navbar />}
      <div>{children}</div>
    </>
  );
}
