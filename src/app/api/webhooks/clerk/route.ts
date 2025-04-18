import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createUser } from "../../../../lib/actions/user.actions";
import { connectToDatabase } from "../../../../lib/database/db";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

if (!CLERK_WEBHOOK_SECRET) {
  throw new Error("Missing Clerk webhook secret in environment variables.");
}

export async function POST(req: NextRequest) {
  try {
    // Parse and verify the webhook payload
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers.entries());
    const webhook = new Webhook(CLERK_WEBHOOK_SECRET);
    const event = webhook.verify(payload, headers) as {
      type: string;
      data: { id: string; username: string };
    };

    // Ensure the event type is `user.created`
    if (event.type !== "user.created") {
      return NextResponse.json(
        { error: "Invalid event type. Only 'user.created' is supported." },
        { status: 400 }
      );
    }

    const { id: clerkId, username } = event.data;

    // Validate the required fields
    if (!clerkId || !username) {
      return NextResponse.json(
        { error: "Missing required fields: clerkId or username." },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Create the user in the database
    await createUser(username, clerkId);

    return NextResponse.json({ message: "User created successfully." }, { status: 201 });
  } catch (error: any) {
    console.error("Error processing Clerk webhook:", error);

    // Handle specific error cases
    if (error.name === "PayloadError") {
      return NextResponse.json(
        { error: "Invalid webhook payload or signature." },
        { status: 400 }
      );
    }

    if (error.message.includes("User with this Clerk ID already exists")) {
      return NextResponse.json(
        { error: "User with this Clerk ID already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
