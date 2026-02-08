import express from "express";
import mongoose from "mongoose";
import Announcement from "../models/Announcements";
import Device from "../models/Device";
import { protect } from "../middleware/auth";
import { emitDeviceUpdate } from "../socket";

const router = express.Router();

/**
 * Helper: figure out which devices should refresh based on target
 */
async function getTargetDeviceKeys(body: any) {
  const { targetType, deviceKeys, kioskIds } = body;

  if (targetType === "ALL") {
    const all = await Device.find().select("deviceKey");
    return all.map(d => d.deviceKey);
  }

  if (targetType === "DEVICES") {
    return Array.isArray(deviceKeys) ? deviceKeys : [];
  }

  if (targetType === "KIOSKS") {
    const ids = Array.isArray(kioskIds) ? kioskIds : [];
    const validIds = ids.filter((id: any) => mongoose.isValidObjectId(id));
    const devices = await Device.find({ activeKioskId: { $in: validIds } }).select("deviceKey");
    return devices.map(d => d.deviceKey);
  }

  return [];
}

/**
 * GET all announcements (CMS)
 */
router.get("/", protect, async (_req, res) => {
  const items = await Announcement.find().sort({ createdAt: -1 });
  res.json(items);
});

/**
 * CREATE announcement (CMS)
 * body:
 * {
 *  title, text,
 *  targetType: "ALL" | "DEVICES" | "KIOSKS",
 *  deviceKeys?: string[],
 *  kioskIds?: string[],
 *  startsAt?: ISO,
 *  expiresAt?: ISO
 * }
 */
router.post("/", protect, async (req, res) => {
  const { title, text, targetType, deviceKeys, kioskIds, startsAt, expiresAt } = req.body;

  if (!title || !text) return res.status(400).json({ message: "title and text are required" });

  const ann = await Announcement.create({
    title,
    text,
    active: true,
    targetType: targetType ?? "ALL",
    deviceKeys: deviceKeys ?? [],
    kioskIds: kioskIds ?? [],
    startsAt: startsAt ? new Date(startsAt) : undefined,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined
  });

  // notify targeted devices
  const keys = await getTargetDeviceKeys({
    targetType: ann.targetType,
    deviceKeys: ann.deviceKeys,
    kioskIds: ann.kioskIds
  });
  keys.forEach(k => emitDeviceUpdate(k));

  res.json(ann);
});

/**
 * ACTIVATE / DEACTIVATE announcement
 */
router.patch("/:id", protect, async (req, res) => {
  const { active, title, text, expiresAt } = req.body;

  const ann = await Announcement.findById(req.params.id);
  if (!ann) return res.status(404).json({ message: "Announcement not found" });

  if (active !== undefined) ann.active = !!active;
  if (title !== undefined) ann.title = title;
  if (text !== undefined) ann.text = text;
  if (expiresAt !== undefined) ann.expiresAt = expiresAt ? new Date(expiresAt) : undefined;

  await ann.save();

  const keys = await getTargetDeviceKeys({
    targetType: ann.targetType,
    deviceKeys: ann.deviceKeys,
    kioskIds: ann.kioskIds
  });
  keys.forEach(k => emitDeviceUpdate(k));

  res.json(ann);
});

/**
 * DELETE announcement
 */
router.delete("/:id", protect, async (req, res) => {
  const ann = await Announcement.findById(req.params.id);
  if (!ann) return res.status(404).json({ message: "Announcement not found" });

  const keys = await getTargetDeviceKeys({
    targetType: ann.targetType,
    deviceKeys: ann.deviceKeys,
    kioskIds: ann.kioskIds
  });

  await ann.deleteOne();

  keys.forEach(k => emitDeviceUpdate(k));

  res.json({ message: "Announcement deleted" });
});

export default router;
