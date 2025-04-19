// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  "/video-chat(.*)", // protect /video-chat and subroutes
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // If route is protected and user is not logged in, redirect
  if (isProtectedRoute(req) && !userId) {
    return NextResponse.redirect(new URL("/pages/auth/register", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Protect only what you need + static/api skips
    "/((?!_next|.*\\..*|favicon.ico).*)", // skip static assets
    "/video-chat(.*)", // explicitly include video-chat
    "/(api|trpc)(.*)", // if you want to run middleware on API routes too
  ],
};
