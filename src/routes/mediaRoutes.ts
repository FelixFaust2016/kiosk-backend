import express from "express";
import fs from "fs";
import path from "path";
import Media from "../models/Media";
import Kiosk from "../models/Playlist";
import Device from "../models/Device";
import { upload } from "../config/multer";
import { protect } from "../middleware/auth";
import { emitDeviceUpdate } from "../socket";

const router = express.Router();

const getBaseUrl = (req: express.Request) => `${req.protocol}://${req.get("host")}`;

// GET all media (CMS)
router.get("/", protect, async (_req, res) => {
  const allMedia = await Media.find().sort({ createdAt: -1 });
  res.json(allMedia);
});

// Upload
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const type: "image" | "video" = req.file.mimetype.startsWith("image") ? "image" : "video";

  const media = await Media.create({
    type,
    url: `${getBaseUrl(req)}/uploads/${req.file.filename}`,
    title: req.file.originalname
  });

  res.json(media);
});

// Update metadata
router.patch("/:id", protect, async (req, res) => {
  const { title } = req.body;

  const updated = await Media.findByIdAndUpdate(req.params.id, { title }, { new: true });
  if (!updated) return res.status(404).json({ message: "Media not found" });

  res.json(updated);
});


router.delete("/:id", protect, async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) return res.status(404).json({ message: "Media not found" });

  const affectedKiosks = await Kiosk.find({ "media.mediaId": media._id }).select("_id");

  await Kiosk.updateMany({}, { $pull: { media: { mediaId: media._id } } });


  const filename = media.url.split("/uploads/")[1];
  if (filename) {
    const filepath = path.join(process.cwd(), "uploads", filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }

  await media.deleteOne();

  const kioskIds = affectedKiosks.map(k => k._id);
  const devices = await Device.find({ activeKioskId: { $in: kioskIds } }).select("deviceKey");
  devices.forEach(d => emitDeviceUpdate(d.deviceKey));

  res.json({
    message: "Media deleted",
    affectedKioskIds: kioskIds
  });
});

export default router;
