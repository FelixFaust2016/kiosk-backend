import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";

import Device from "../models/Device";
import Kiosk from "../models/Playlist";
import Announcement from "../models/Announcements";

import { protect } from "../middleware/auth";
import { emitDeviceUpdate } from "../socket";

const router = express.Router();

async function pickDefaultKioskId(): Promise<mongoose.Types.ObjectId | null> {
  const envId = process.env.DEFAULT_KIOSK_ID;

  if (envId && mongoose.isValidObjectId(envId)) {
    const exists = await Kiosk.findById(envId).select("_id");
    if (exists) return exists._id as any;
  }

  const first = await Kiosk.findOne().sort({ name: 1 }).select("_id");
  return first ? (first._id as any) : null;
}

// KIOSK APP: register device (first boot)
router.post("/register", async (req, res) => {
  const name = req.body?.name || "Kiosk Screen";
  const deviceKey = crypto.randomBytes(16).toString("hex");

  const activeKioskId = await pickDefaultKioskId();

  const device = await Device.create({
    name,
    deviceKey,
    activeKioskId: activeKioskId ?? undefined
  });

  res.json(device);
});

// CMS: list devices
router.get("/", protect, async (_req, res) => {
  const devices = await Device.find()
    .populate("activeKioskId")
    .sort({ lastSeenAt: -1 });

  res.json(devices);
});

// KIOSK APP: get active kiosk config for this deviceKey
router.get("/:deviceKey/active", async (req, res) => {
  const device = await Device.findOne({ deviceKey: req.params.deviceKey });
  if (!device) return res.status(404).json({ message: "Device not found" });

  // heartbeat
  device.lastSeenAt = new Date();

  // ✅ self-heal: if no activeKioskId, assign fallback and save
  if (!device.activeKioskId) {
    let fallback = undefined as any;

    if (process.env.DEFAULT_KIOSK_ID) {
      const exists = await Kiosk.findById(process.env.DEFAULT_KIOSK_ID).select("_id");
      if (exists) fallback = exists._id;
    }

    if (!fallback) {
      const first = await Kiosk.findOne().sort({ name: 1 }).select("_id");
      if (first) fallback = first._id;
    }

    if (fallback) {
      device.activeKioskId = fallback;
    }
  }

  await device.save();

  const now = new Date();

  // fetch announcements targeting this device OR its active kiosk OR everyone
  const announcements = await Announcement.find({
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }] }
    ],
    $or: [
      { targetType: "ALL" },
      { targetType: "DEVICES", deviceKeys: device.deviceKey },
      ...(device.activeKioskId ? [{ targetType: "KIOSKS", kioskIds: device.activeKioskId }] : [])
    ]
  }).sort({ createdAt: -1 });

  // if still no kiosk assigned (e.g. no kiosks exist in DB)
  if (!device.activeKioskId) {
    return res.json({
      deviceKey: device.deviceKey,
      activeKiosk: null,
      announcements: announcements.map((a: any) => ({
        _id: a._id,
        title: a.title,
        text: a.text,
        expiresAt: a.expiresAt
      }))
    });
  }

  // fetch kiosk config
  const kiosk = await Kiosk.findById(device.activeKioskId).populate("media.mediaId");

  // kiosk was deleted or invalid reference → clear assignment
  if (!kiosk) {
    device.activeKioskId = undefined as any;
    await device.save();

    return res.json({
      deviceKey: device.deviceKey,
      activeKiosk: null,
      announcements: announcements.map((a: any) => ({
        _id: a._id,
        title: a.title,
        text: a.text,
        expiresAt: a.expiresAt
      }))
    });
  }

  // build playlist
  const sorted = [...kiosk.media].sort((a: any, b: any) => a.order - b.order);
  const playlist = sorted.map((item: any) => ({
    order: item.order,
    duration: item.duration ?? null,
    effectiveDuration: item.duration ?? kiosk.mediaDisplayTime, // keep your field name
    media: item.mediaId
  }));

  res.json({
    deviceKey: device.deviceKey,
    activeKiosk: {
      _id: kiosk._id,
      name: kiosk.name,
      defaultDisplayTime: kiosk.mediaDisplayTime,
      playlist
    },
    announcements: announcements.map((a: any) => ({
      _id: a._id,
      title: a.title,
      text: a.text,
      expiresAt: a.expiresAt
    }))
  });
});

// CMS: assign which kiosk is active on this device
router.post("/:deviceKey/assign", protect, async (req, res) => {
  const { kioskId } = req.body;

  if (!mongoose.isValidObjectId(kioskId)) {
    return res.status(400).json({ message: "Invalid kioskId" });
  }

  const kiosk = await Kiosk.findById(kioskId).select("_id");
  if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

  const device = await Device.findOneAndUpdate(
    { deviceKey: req.params.deviceKey },
    { activeKioskId: kiosk._id },
    { new: true }
  );

  if (!device) return res.status(404).json({ message: "Device not found" });

  emitDeviceUpdate(device.deviceKey);
  res.json({ message: "Device assigned", device });
});

export default router;
