import { NextRequest, NextResponse } from "next/server";
import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, ...data } = body;

  await pusher.trigger("webrtc-vchat", type, data);
  return NextResponse.json({ message: "ok" }, { status: 200 });
}
