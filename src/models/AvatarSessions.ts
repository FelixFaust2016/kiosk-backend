import mongoose, { Document } from "mongoose";

export interface IAvatarSession extends Document {
  deviceKey: string;
  kioskId?: mongoose.Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  lastMessageAt: Date;
}

const avatarSessionSchema = new mongoose.Schema<IAvatarSession>({
  deviceKey: { type: String, required: true, index: true },
  kioskId: { type: mongoose.Schema.Types.ObjectId, ref: "Kiosk" },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  lastMessageAt: { type: Date, default: Date.now, index: true }
});

export default mongoose.model<IAvatarSession>("AvatarSession", avatarSessionSchema);
