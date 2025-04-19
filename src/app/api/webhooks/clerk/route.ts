import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createUser, updateUser, deleteUser } from "../../../../lib/actions/user.actions";
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
      data: {
        id: string;
        username?: string;
        email_addresses?: { email_address: string }[];
      };
    };

    const { id: clerkId, username, email_addresses } = event.data;
    const email = email_addresses?.[0]?.email_address || "";

    // Connect to the database
    await connectToDatabase();

    if (event.type === "user.created") {
      // Handle user creation
      if (!clerkId || !username) {
        return NextResponse.json(
          { error: "Missing required fields: clerkId or username." },
          { status: 400 }
        );
      }
      await createUser(username, clerkId, email, "");
      return NextResponse.json({ message: "User created successfully." }, { status: 201 });
    } else if (event.type === "user.updated") {
      // Handle user update
      await updateUser(clerkId, { username, email });
      return NextResponse.json({ message: "User updated successfully." }, { status: 200 });
    } else if (event.type === "user.deleted") {
      // Handle user deletion
      await deleteUser(clerkId);
      return NextResponse.json({ message: "User deleted successfully." }, { status: 200 });
    } else {
      return NextResponse.json(
        { error: "Unsupported event type." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error processing Clerk webhook:", error);

    // Handle specific error cases
    if (error.name === "PayloadError") {
      return NextResponse.json(
        { error: "Invalid webhook payload or signature." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
