import express from "express";
import { protect } from "../middleware/auth";
import Device from "../models/Device";
import Kiosk from "../models/Playlist";
import AvatarSession from "../models/AvatarSessions";
import AvatarMessage from "../models/AvatarMessage";
import { generateAssistantReply } from "../services/llm";

const router = express.Router();

const MAX_LEN = 500;

// KIOSK: start a session
// POST /avatar/sessions { deviceKey }
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
// POST /avatar/sessions/:id/messages { text }
router.post("/sessions/:id/messages", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string")
    return res.status(400).json({ message: "text required" });

  const trimmed = text.trim();
  if (!trimmed) return res.status(400).json({ message: "text empty" });
  if (trimmed.length > MAX_LEN)
    return res.status(400).json({ message: `text too long (max ${MAX_LEN})` });

  const session = await AvatarSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });

  // Build system prompt from kiosk (optional but impressive)
  // Build system prompt from kiosk (optional but impressive)
  // Build system prompt from kiosk avatarConfig
  let system = "You are a helpful kiosk assistant.";
  let maxReplyChars = 400;

  if (session.kioskId) {
    const kiosk = await Kiosk.findById(session.kioskId).select(
      "name avatarConfig"
    );
    const cfg: any = kiosk?.avatarConfig;

    // Optional: allow turning avatar off per kiosk
    if (cfg?.enabled === false) {
      return res
        .status(403)
        .json({ message: "Avatar disabled for this kiosk" });
    }

    const assistantName = cfg?.name || "Assistant";
    const tone = cfg?.tone || "friendly";
    const lang = cfg?.language || "en";
    maxReplyChars =
      typeof cfg?.maxReplyChars === "number" ? cfg.maxReplyChars : 400;

    const venueLine = cfg?.venueName
      ? `You are the on-screen assistant for ${cfg.venueName}.`
      : kiosk?.name
      ? `You are the on-screen assistant for "${kiosk.name}".`
      : "";

    const venueDesc = cfg?.venueDescription
      ? `Venue info: ${cfg.venueDescription}`
      : "";

    const refuse =
      Array.isArray(cfg?.refuseTopics) && cfg.refuseTopics.length
        ? `If asked about these topics, refuse briefly: ${cfg.refuseTopics.join(
            ", "
          )}.`
        : "";

    const extra = cfg?.systemPrompt
      ? `Extra instructions: ${cfg.systemPrompt}`
      : "";

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

  // Save user message
  await AvatarMessage.create({
    sessionId: session._id,
    role: "user",
    text: trimmed,
  });

  // Convert history to role/text pairs (exclude the just-added user message to avoid duplication)
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
    reply.length > maxReplyChars
      ? reply.slice(0, maxReplyChars - 1) + "…"
      : reply;

  // Save assistant reply
  await AvatarMessage.create({
    sessionId: session._id,
    role: "assistant",
    text: finalReply,
  });

  session.lastMessageAt = new Date();
  await session.save();

  res.json({ reply: finalReply });
});

// CMS: list sessions (filters)
// GET /avatar/sessions?deviceKey=...&kioskId=...
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
// GET /avatar/sessions/:id
router.get("/sessions/:id", protect, async (req, res) => {
  const session = await AvatarSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });

  const messages = await AvatarMessage.find({ sessionId: session._id }).sort({
    createdAt: 1,
  });

  res.json({ session, messages });
});

// CMS: end session (optional)
// POST /avatar/sessions/:id/end
router.post("/sessions/:id/end", protect, async (req, res) => {
  const session = await AvatarSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });

  session.endedAt = new Date();
  await session.save();

  res.json({ message: "Session ended" });
});

export default router;
