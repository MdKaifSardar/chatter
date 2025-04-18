import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  username: string;
  clerkId: string;
  email: string;
  pass: string;
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, default: "" }, // Optional field
    pass: { type: String, default: "" }, // Optional field
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
