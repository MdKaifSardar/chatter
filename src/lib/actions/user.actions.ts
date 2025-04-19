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
