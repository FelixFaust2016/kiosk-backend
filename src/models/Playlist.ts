import mongoose, { Document } from "mongoose";

export interface IPlaylist extends Document {
  name: string;
  mediaDisplayTime: number;
  media: {
    mediaId: mongoose.Types.ObjectId;
    order: number;
    duration: number;
  }[];
  avatarConfig: {
    enabled: { type: Boolean; default: true };
    name: { type: String; default: "Assistant" };
    tone: { type: String; default: "friendly" };
    language: { type: String; default: "en" };
    systemPrompt: { type: String; default: "" };
    maxReplyChars: { type: Number; default: 400 };
    venueName: { type: String; default: "" };
    venueDescription: { type: String; default: "" };
    refuseTopics: [{ type: String }];
  };
}

const playlistSchema = new mongoose.Schema<IPlaylist>(
  {
    name: String,
    mediaDisplayTime: { type: Number, default: 5 },
    media: [
      {
        mediaId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Media",
          required: true,
        },
        order: Number,
        duration: Number,
      },
    ],

    avatarConfig: {
      enabled: { type: Boolean, default: true },
      name: { type: String, default: "Assistant" },
      tone: { type: String, default: "friendly" },
      language: { type: String, default: "en" },
      systemPrompt: { type: String, default: "" },
      maxReplyChars: { type: Number, default: 400 },
      venueName: { type: String, default: "" },
      venueDescription: { type: String, default: "" },
      refuseTopics: [{ type: String }],
    },
  },
  { timestamps: true }
);

export default mongoose.model<IPlaylist>("Playlist", playlistSchema);
