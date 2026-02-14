import express from "express";
import mongoose from "mongoose";
import Kiosk from "../models/Playlist";
import Media from "../models/Media";
import Device from "../models/Device";
import { protect } from "../middleware/auth";
import { emitDeviceUpdate } from "../socket";

const router = express.Router();

// CMS: list all kiosks (+ playlist preview)
router.get("/", protect, async (_req, res) => {
  const kiosks = await Kiosk.find().populate("media.mediaId").sort({ name: 1 });

  const result = kiosks.map((k: any) => {
    const preview = [...k.media]
      .sort((a: any, b: any) => a.order - b.order)
      .slice(0, 5)
      .map((item: any) => ({
        order: item.order,
        effectiveDuration: item.duration ?? k.mediaDisplayTime,
        media: item.mediaId,
      }));

    return {
      _id: k._id,
      name: k.name,
      mediaDisplayTime: k.mediaDisplayTime,
      playlistCount: k.media.length,
      playlistPreview: preview,
    };
  });

  res.json(result);
});

// KIOSK APP: get kiosk config by id (still supported)
router.get("/:id", async (req, res) => {
  const kiosk = await Kiosk.findById(req.params.id).populate("media.mediaId");
  if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

  const sorted = [...kiosk.media].sort((a, b) => a.order - b.order);

  const playlist = sorted.map((item: any) => ({
    order: item.order,
    duration: item.duration ?? null,
    effectiveDuration: item.duration ?? kiosk.mediaDisplayTime,
    media: item.mediaId,
  }));

  res.json({
    _id: kiosk._id,
    name: kiosk.name,
    mediaDisplayTime: kiosk.mediaDisplayTime,
    avatarConfig: kiosk.avatarConfig,
    playlist,
  });
});

// CMS: create kiosk
router.post("/", protect, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "name required" });

  const kiosk = await Kiosk.create({ name });
  res.json(kiosk);
});

// CMS: update default display time
router.post("/:id/default-display-time", protect, async (req, res) => {
  const { time } = req.body;

  if (typeof time !== "number" || time <= 0) {
    return res.status(400).json({ message: "time must be a positive number" });
  }

  const updated = await Kiosk.findByIdAndUpdate(
    req.params.id,
    { mediaDisplayTime: time },
    { new: true }
  );

  if (!updated) return res.status(404).json({ message: "Kiosk not found" });

  // notify devices currently showing this kiosk
  const devices = await Device.find({ activeKioskId: updated._id }).select(
    "deviceKey"
  );
  devices.forEach((d) => emitDeviceUpdate(d.deviceKey));

  res.json({ message: "Default display time updated" });
});

// CMS: replace kiosk playlist (edit playlist)
router.put("/:id/playlist", protect, async (req, res) => {
  const { playlist } = req.body;

  if (!Array.isArray(playlist)) {
    return res.status(400).json({ message: "playlist must be an array" });
  }

  for (const item of playlist) {
    if (!item.mediaId || typeof item.order !== "number") {
      return res
        .status(400)
        .json({ message: "Each item needs mediaId and order" });
    }
    if (!mongoose.isValidObjectId(item.mediaId)) {
      return res
        .status(400)
        .json({ message: `Invalid mediaId: ${item.mediaId}` });
    }
    if (
      item.duration !== undefined &&
      (typeof item.duration !== "number" || item.duration <= 0)
    ) {
      return res
        .status(400)
        .json({ message: "duration must be a positive number if provided" });
    }
  }

  // ensure media exists
  const ids = playlist.map((p: any) => p.mediaId);
  const count = await Media.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) {
    return res
      .status(400)
      .json({ message: "One or more mediaId values do not exist" });
  }

  const updated = await Kiosk.findByIdAndUpdate(
    req.params.id,
    { media: playlist },
    { new: true }
  );

  if (!updated) return res.status(404).json({ message: "Kiosk not found" });

  // notify devices currently showing this kiosk
  const devices = await Device.find({ activeKioskId: updated._id }).select(
    "deviceKey"
  );
  devices.forEach((d) => emitDeviceUpdate(d.deviceKey));

  res.json({ message: "Kiosk playlist updated" });
});

// DELETE a kiosk (CMS only)
router.delete("/:id", protect, async (req, res) => {
  const kioskId = req.params.id;

  const kiosk = await Kiosk.findById(kioskId);
  if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

  // Find devices currently assigned to this kiosk
  const devices = await Device.find({ activeKioskId: kiosk._id }).select(
    "deviceKey"
  );

  // Unassign this kiosk from those devices
  await Device.updateMany(
    { activeKioskId: kiosk._id },
    { $unset: { activeKioskId: "" } }
  );

  // Delete the kiosk
  await kiosk.deleteOne();

  // Notify affected devices to refresh
  devices.forEach((d) => emitDeviceUpdate(d.deviceKey));

  res.json({
    message: "Kiosk deleted",
    unassignedDevices: devices.map((d) => d.deviceKey),
  });
});

// Update avatar config (CMS)
router.patch("/:id/avatar-config", protect, async (req, res) => {
  const { avatarConfig } = req.body;
  if (!avatarConfig || typeof avatarConfig !== "object") {
    return res.status(400).json({ message: "avatarConfig object is required" });
  }

  const kiosk = await Kiosk.findById(req.params.id);
  if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

  kiosk.avatarConfig = {
    ...(kiosk.avatarConfig || {}),
    ...avatarConfig
  };

  await kiosk.save();

  res.json(kiosk.avatarConfig);
});


export default router;
