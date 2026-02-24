import "dotenv/config";
import path from "path";
import fs from "fs/promises";

import { ttsElevenlabs } from "../services/ttsElevenlabs";
import { mp3ToWav } from "../services/audioConvert";
import { rhubarbLipsync } from "../services/rhubarb";

async function main() {
  const id = "greeting";
  const text =
    "Hi! I’m Ava. I can help with questions about this venue—just ask me anything.";

  console.log("[greeting] generating mp3…");
  const tts = await ttsElevenlabs(text, id); // ✅ uses jobId-style id now

  // WAV path
  const wavAbsPath = path.join(process.cwd(), "public/media/tts", `${id}.wav`);

  console.log("[greeting] converting mp3 -> wav…");
  await mp3ToWav(tts.absMp3Path, wavAbsPath);

  console.log("[greeting] generating rhubarb lipsync json…");
  const lipsync = await rhubarbLipsync(wavAbsPath, id);

  // Save json explicitly (your rhubarb may already write it; this guarantees it)
  const jsonAbsPath = path.join(
    process.cwd(),
    "public/media/lipsync",
    `${id}.json`
  );
  await fs.mkdir(path.dirname(jsonAbsPath), { recursive: true });
  await fs.writeFile(jsonAbsPath, JSON.stringify(lipsync, null, 2), "utf8");

  console.log("[greeting] cleaning up wav…");
  await fs.unlink(wavAbsPath).catch(() => {});

  console.log("✅ DONE");
  console.log("MP3:", `/media/tts/${id}.mp3`);
  console.log("JSON:", `/media/lipsync/${id}.json`);
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});