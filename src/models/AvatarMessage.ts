import mongoose, { Document } from "mongoose";

export type AvatarRole = "user" | "assistant";

export interface IAvatarMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  role: AvatarRole;
  text: string;
  createdAt: Date;
}

const avatarMessageSchema = new mongoose.Schema<IAvatarMessage>({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AvatarSession", required: true, index: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

export default mongoose.model<IAvatarMessage>("AvatarMessage", avatarMessageSchema);
