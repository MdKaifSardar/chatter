"use server";

import User, { IUser } from "../models/user.model";
import { connectToDatabase } from "../database/db";

export const createUser = async (
  username: string,
  clerkId: string,
  email: string = "",
  pass: string = ""
): Promise<IUser> => {
  await connectToDatabase();

  // Check if the user already exists
  const existingUser = await User.findOne({ clerkId });
  if (existingUser) {
    throw new Error("User with this Clerk ID already exists.");
  }

  // Create a new user
  const newUser = new User({ username, clerkId, email, pass });
  await newUser.save();

  return newUser;
};

export const updateUser = async (
  clerkId: string,
  updates: Partial<{ username: string; email: string }>
): Promise<IUser | null> => {
  await connectToDatabase();

  // Find the user by clerkId
  const user = await User.findOne({ clerkId });
  if (!user) {
    throw new Error("User not found.");
  }

  // Update the user details
  if (updates.username) user.username = updates.username;
  if (updates.email) user.email = updates.email;

  await user.save();
  return user;
};

export const deleteUser = async (clerkId: string): Promise<void> => {
  await connectToDatabase();

  // Delete the user by clerkId
  const result = await User.deleteOne({ clerkId });
  if (result.deletedCount === 0) {
    throw new Error("User not found.");
  }
};

export const getAllUsers = async (): Promise<{ username: string; email: string; clerkId: string }[]> => {
  try {
    await connectToDatabase();

    // Fetch all users and return username, email, and clerkId
    const users = await User.find({}, "username email clerkId");
    return users.map((user) => ({
      username: user.username,
      email: user.email,
      clerkId: user.clerkId,
    }));
  } catch (error: any) {
    console.error("Error fetching users:", error);
    throw new Error("Failed to fetch users. Please try again later.");
  }
};

export const getUserByClerkId = async (
  clerkId: string
): Promise<{ username: string; email: string; clerkId: string } | null> => {
  await connectToDatabase();
  const user = await User.findOne({ clerkId }, "username email clerkId");
  if (!user) return null;
  return {
    username: user.username,
    email: user.email,
    clerkId: user.clerkId,
  };
};
