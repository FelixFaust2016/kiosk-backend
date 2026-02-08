import mongoose, { Document } from "mongoose";

type TargetType = "ALL" | "DEVICES" | "KIOSKS";

export interface IAnnouncement extends Document {
  title: string;
  text: string;
  active: boolean;
  targetType: TargetType;
  deviceKeys?: string[]; // used when targetType=DEVICES
  kioskIds?: mongoose.Types.ObjectId[]; // used when targetType=KIOSKS
  startsAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new mongoose.Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    text: { type: String, required: true },
    active: { type: Boolean, default: true },

    targetType: { type: String, enum: ["ALL", "DEVICES", "KIOSKS"], default: "ALL" },
    deviceKeys: [{ type: String }],
    kioskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Kiosk" }],

    startsAt: { type: Date },
    expiresAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model<IAnnouncement>("Announcement", announcementSchema);
