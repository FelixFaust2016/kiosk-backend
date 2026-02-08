import mongoose, { Document } from "mongoose";

export interface IDevice extends Document {
  name: string;
  deviceKey: string;
  activeKioskId?: mongoose.Types.ObjectId;
  lastSeenAt: Date;
}

const deviceSchema = new mongoose.Schema<IDevice>({
  name: { type: String, required: true },
  deviceKey: { type: String, required: true, unique: true },
  activeKioskId: { type: mongoose.Schema.Types.ObjectId, ref: "Kiosk" },
  lastSeenAt: { type: Date, default: Date.now }
});

export default mongoose.model<IDevice>("Device", deviceSchema);
