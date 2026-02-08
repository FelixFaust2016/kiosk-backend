import express from "express";
import crypto from "crypto";
import Device from "../models/Device";
import Kiosk from "../models/Playlist";
import Announcement from "../models/Announcements";
import { protect } from "../middleware/auth";
import { emitDeviceUpdate } from "../socket";

const router = express.Router();

// KIOSK APP: register device (first boot)
// returns deviceKey that the kiosk app stores in localStorage
router.post("/register", async (req, res) => {
  const name = req.body?.name || "Kiosk Screen";
  const deviceKey = crypto.randomBytes(16).toString("hex");

  const device = await Device.create({ name, deviceKey });
  res.json(device);
});

// CMS: list devices
router.get("/", protect, async (_req, res) => {
  const devices = await Device.find().populate("activeKioskId").sort({ lastSeenAt: -1 });
  res.json(devices);
});

// KIOSK APP: get active kiosk config for this deviceKey
router.get("/:deviceKey/active", async (req, res) => {
  const device = await Device.findOne({ deviceKey: req.params.deviceKey });
  if (!device) return res.status(404).json({ message: "Device not found" });

  // heartbeat
  device.lastSeenAt = new Date();
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
      ...(device.activeKioskId
        ? [{ targetType: "KIOSKS", kioskIds: device.activeKioskId }]
        : [])
    ]
  }).sort({ createdAt: -1 });

  // if no kiosk assigned
  if (!device.activeKioskId) {
    return res.json({
      deviceKey: device.deviceKey,
      activeKiosk: null,
      announcements: announcements.map((a) => ({
        _id: a._id,
        title: a.title,
        text: a.text,
        expiresAt: a.expiresAt
      }))
    });
  }

  // fetch kiosk config
  const kiosk = await Kiosk.findById(device.activeKioskId).populate("media.mediaId");
  if (!kiosk) {
    return res.json({
      deviceKey: device.deviceKey,
      activeKiosk: null,
      announcements: announcements.map((a) => ({
        _id: a._id,
        title: a.title,
        text: a.text,
        expiresAt: a.expiresAt
      }))
    });
  }

  // build playlist
  const sorted = [...kiosk.media].sort((a, b) => a.order - b.order);
  const playlist = sorted.map((item: any) => ({
    order: item.order,
    duration: item.duration ?? null,
    effectiveDuration: item.duration ?? kiosk.mediaDisplayTime,
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
    announcements: announcements.map((a) => ({
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

  const kiosk = await Kiosk.findById(kioskId);
  if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

  const device = await Device.findOneAndUpdate(
    { deviceKey: req.params.deviceKey },
    { activeKioskId: kioskId },
    { new: true }
  );

  if (!device) return res.status(404).json({ message: "Device not found" });

  emitDeviceUpdate(device.deviceKey);
  res.json({ message: "Device assigned", device });
});

export default router;
