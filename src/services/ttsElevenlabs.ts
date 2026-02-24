import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

type ElevenLabsOptions = {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
};

export async function ttsElevenlabs(
  text: string,
  id: string,
  opts: ElevenLabsOptions = {}
) {
  const voiceId = opts.voiceId ?? process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID missing");
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing");

  const mp3AbsPath = path.join(process.cwd(), "public/media/tts", `${id}.mp3`);
  await fs.mkdir(path.dirname(mp3AbsPath), { recursive: true });

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: opts.modelId ?? "eleven_multilingual_v2",
        voice_settings: {
          stability: opts.stability ?? 0.8,
          similarity_boost: opts.similarityBoost ?? 0.6,
          style: opts.style ?? 0.2,
          use_speaker_boost: opts.useSpeakerBoost ?? true,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`ElevenLabs failed (${res.status}): ${err}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(mp3AbsPath, buf);

  return {
    id,
    audioUrl: `/media/tts/${id}.mp3`,
    absMp3Path: mp3AbsPath,
  };
}