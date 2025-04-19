import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  username: string;
  clerkId: string;
  email: string;
  pass: string;
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true }, // Ensure unique username
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, default: "", unique: true }, // Ensure unique email
    pass: { type: String, default: "" },
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
