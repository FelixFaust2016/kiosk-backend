import OpenAI from "openai";

const useLLM = process.env.AVATAR_USE_LLM === "true";
const model = process.env.OPENAI_MODEL || "gpt-5";

const client = useLLM
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function generateAssistantReply(params: {
  system: string;
  conversation: { role: "user" | "assistant"; text: string }[];
  userText: string;
}) {
  const { system, conversation, userText } = params;

  // Fallback (still works if no key)
  if (!useLLM || !client) {
    return `Got it. You said: "${userText}". (LLM disabled — set AVATAR_USE_LLM=true)`;
  }

  // Responses API is the recommended API for new projects. :contentReference[oaicite:3]{index=3}
  const input: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...conversation.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: userText },
  ];

  const resp = await client.responses.create({
    model,
    input,
  });

  // `output_text` is a convenient text aggregate from Responses. :contentReference[oaicite:4]{index=4}
  const text = (resp as any).output_text?.trim?.() || "";
  return text || "Sorry — I couldn’t generate a response right now.";
}
