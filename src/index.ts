import dotenv from "dotenv";
dotenv.config();
import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import { initSocket } from "./socket";
import path from "path";

import authRoutes from "./routes/authRoutes";
import mediaRoutes from "./routes/mediaRoutes";
import kioskRoutes from "./routes/playlistRoutes";
import deviceRoutes from "./routes/deviceRoutes";
import announcementRoutes from "./routes/announcementRoutes";
import avatarRoutes from "./routes/avatarRoutes";
import sensorRoutes from "./routes/sensorRoutes";

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => console.log("Mongo connected"))
  .catch((e) => console.error("Mongo error:", e));

initSocket(server);

app.get("/", (_req, res) => res.send("API running"));

app.use("/auth", authRoutes);

app.use(
  "/media",
  express.static(path.join(process.cwd(), "public/media"))
);
app.use("/media", mediaRoutes);


app.use("/kiosk", kioskRoutes);
app.use("/devices", deviceRoutes);
app.use("/announcements", announcementRoutes);
app.use("/avatar", avatarRoutes);
app.use("/sensors", sensorRoutes);

server.listen(process.env.PORT, () => {
  console.log(`Server running on ${process.env.PORT}`);
});
