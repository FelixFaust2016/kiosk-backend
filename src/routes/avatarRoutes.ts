import express from "express";
import { protect } from "../middleware/auth";
import Device from "../models/Device";
import Kiosk from "../models/Playlist";
import AvatarSession from "../models/AvatarSessions";
import AvatarMessage from "../models/AvatarMessage";
import { generateAssistantReply } from "../services/llm";
import { getJob } from "../services/avatarJobs";
import { createJob } from "../services/avatarJobs";
import { runVoiceJob } from "../services/avatarVoicePipeline";

const router = express.Router();

const MAX_LEN = 500;


router.get("/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Job not found" });

  res.json({
    id: job.id,
    status: job.status,
    audioUrl: job.audioUrl,
    lipsync: job.lipsync,
    error: job.error,
  });
});

// KIOSK: start a session
router.post("/sessions", async (req, res) => {
  const { deviceKey } = req.body;
  if (!deviceKey)
    return res.status(400).json({ message: "deviceKey required" });

  const device = await Device.findOne({ deviceKey });
  if (!device) return res.status(404).json({ message: "Device not found" });

  const session = await AvatarSession.create({
    deviceKey,
    kioskId: device.activeKioskId ?? undefined,
  });

  res.json(session);
});

// KIOSK: send a message and get assistant reply
router.post("/sessions/:id/messages", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string")
      return res.status(400).json({ message: "text required" });

    const trimmed = text.trim();
    if (!trimmed) return res.status(400).json({ message: "text empty" });
    if (trimmed.length > MAX_LEN)
      return res.status(400).json({ message: `text too long (max ${MAX_LEN})` });

    const session = await AvatarSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Build system prompt from kiosk avatarConfig
    let system = "You are a helpful kiosk assistant.";
    let maxReplyChars = 400;

    if (session.kioskId) {
      const kiosk = await Kiosk.findById(session.kioskId).select("name avatarConfig");
      const cfg: any = kiosk?.avatarConfig;

      if (cfg?.enabled === false) {
        return res.status(403).json({ message: "Avatar disabled for this kiosk" });
      }

      const assistantName = cfg?.name || "Assistant";
      const tone = cfg?.tone || "friendly";
      const lang = cfg?.language || "en";
      maxReplyChars = typeof cfg?.maxReplyChars === "number" ? cfg.maxReplyChars : 400;

      const venueLine = cfg?.venueName
        ? `You are the on-screen assistant for ${cfg.venueName}.`
        : kiosk?.name
        ? `You are the on-screen assistant for "${kiosk.name}".`
        : "";

      const venueDesc = cfg?.venueDescription ? `Venue info: ${cfg.venueDescription}` : "";

      const refuse =
        Array.isArray(cfg?.refuseTopics) && cfg.refuseTopics.length
          ? `If asked about these topics, refuse briefly: ${cfg.refuseTopics.join(", ")}.`
          : "";

      const extra = cfg?.systemPrompt ? `Extra instructions: ${cfg.systemPrompt}` : "";

      system = [
        venueLine,
        `Your name is ${assistantName}.`,
        `Respond in ${lang}.`,
        `Tone: ${tone}.`,
        `Be concise. Keep replies under ${maxReplyChars} characters.`,
        venueDesc,
        refuse,
        extra,
      ]
        .filter(Boolean)
        .join("\n");
    }

    // Get last N messages for context
    const history = await AvatarMessage.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(12);

    await AvatarMessage.create({
      sessionId: session._id,
      role: "user",
      text: trimmed,
    });

    const convo = history.map((m) => ({
      role: m.role as "user" | "assistant",
      text: m.text,
    }));

    const reply = await generateAssistantReply({
      system,
      conversation: convo,
      userText: trimmed,
    });

    const finalReply =
      reply.length > maxReplyChars ? reply.slice(0, maxReplyChars - 1) + "…" : reply;

    // Save assistant reply
    await AvatarMessage.create({
      sessionId: session._id,
      role: "assistant",
      text: finalReply,
    });

    session.lastMessageAt = new Date();
    await session.save();

    const job = createJob(session._id.toString());


    const MAX_SPOKEN = 220;
    const spokenText =
      finalReply.length > MAX_SPOKEN ? finalReply.slice(0, MAX_SPOKEN - 1) + "…" : finalReply;

    runVoiceJob(job.id, spokenText);

    return res.json({
      reply: finalReply,
      jobId: job.id,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Internal server error" });
  }
});

// CMS: list sessions (filters)

router.get("/sessions", protect, async (req, res) => {
  const { deviceKey, kioskId } = req.query as any;

  const q: any = {};
  if (deviceKey) q.deviceKey = deviceKey;
  if (kioskId) q.kioskId = kioskId;

  const sessions = await AvatarSession.find(q)
    .sort({ lastMessageAt: -1 })
    .limit(200);

  res.json(sessions);
});

// CMS: get a session + messages transcript
router.get("/sessions/:id", protect, async (req, res) => {
  const session = await AvatarSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });

  const messages = await AvatarMessage.find({ sessionId: session._id }).sort({
    createdAt: 1,
  });

  res.json({ session, messages });
});

// CMS: end session (optional)
router.post("/sessions/:id/end", protect, async (req, res) => {
  const session = await AvatarSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });

  session.endedAt = new Date();
  await session.save();

  res.json({ message: "Session ended" });
});

// DASHBOARD: quick stats (admin)
router.get("/dashboard/stats", protect, async (req, res) => {
  try {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);

    // - Devices stats
    const [totalDevices, activeDevices] = await Promise.all([
      Device.countDocuments({}),
      Device.countDocuments({ activeKioskId: { $exists: true, $ne: null } }),
    ]);

    // -- Sessions stats
    const [totalSessions, activeSessions, sessionsLast24h] = await Promise.all([
      AvatarSession.countDocuments({}),
      AvatarSession.countDocuments({ endedAt: { $exists: false } }),
      AvatarSession.countDocuments({ createdAt: { $gte: since24h } }),
    ]);

    // --- Messages stats
    const [totalMessages, messagesLast24h] = await Promise.all([
      AvatarMessage.countDocuments({}),
      AvatarMessage.countDocuments({ createdAt: { $gte: since24h } }),
    ]);

    // -- Last 3 kiosks created
    const last3Kiosks = await Kiosk.find({})
      .select("name createdAt")
      .sort({ createdAt: -1 })
      .limit(3);

    // - Top kiosks by sessions
    const topKiosks = await AvatarSession.aggregate([
      { $match: { kioskId: { $ne: null } } },
      { $group: { _id: "$kioskId", sessions: { $sum: 1 } } },
      { $sort: { sessions: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: Kiosk.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "kiosk",
        },
      },
      { $unwind: { path: "$kiosk", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          kioskId: "$_id",
          sessions: 1,
          name: "$kiosk.name",
        },
      },
    ]);

    const recentSessions = await AvatarSession.find({})
      .select("deviceKey kioskId createdAt lastMessageAt endedAt")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      totals: {
        devices: totalDevices,
        activeDevices,

        sessions: totalSessions,
        activeSessions,
        sessionsLast24h,

        messages: totalMessages,
        messagesLast24h,
      },

      last3Kiosks,
      topKiosks,
      recentSessions,
    });

  } catch (e: any) {
    console.error(e);
    return res.status(500).json({
      message: e?.message || "Failed to fetch dashboard stats",
    });
  }
});

export default router;
