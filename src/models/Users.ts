import mongoose, { Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password: string;
  role: string;
}

const userSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "admin" }
});

export default mongoose.model<IUser>("User", userSchema);
