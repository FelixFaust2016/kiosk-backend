import mongoose, { Document } from "mongoose";

export interface IMedia extends Document {
  type: "image" | "video";
  url: string;      // absolute url
  title?: string;   // editable label
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new mongoose.Schema<IMedia>(
  {
    type: { type: String, enum: ["image", "video"], required: true },
    url: { type: String, required: true },
    title: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model<IMedia>("Media", mediaSchema);
