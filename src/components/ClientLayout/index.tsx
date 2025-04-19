"use client";

import { usePathname } from "next/navigation";
import Navbar from "../Navbar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname?.startsWith("/pages/auth/register") ||
    pathname?.startsWith("/pages/auth/sign-in");

  return (
    <>
      {!isAuthPage && <Navbar />}
      {children}
    </>
  );
}
