"use server"

import User, { IUser } from "../models/user.model";
import { connectToDatabase } from "../database/db";

export const createUser = async (username: string, clerkId: string): Promise<IUser> => {
  await connectToDatabase();

  // Check if the user already exists
  const existingUser = await User.findOne({ clerkId });
  if (existingUser) {
    throw new Error("User with this Clerk ID already exists.");
  }

  // Create a new user
  const newUser = new User({ username, clerkId });
  await newUser.save();

  return newUser;
};
