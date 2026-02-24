import path from "path";
import fs from "fs/promises";
import { updateJob } from "./avatarJobs";
import { ttsElevenlabs } from "./ttsElevenlabs";
import { mp3ToWav } from "./audioConvert";
import { rhubarbLipsync } from "./rhubarb";

export async function runVoiceJob(jobId: string, text: string) {
  updateJob(jobId, { status: "working" });

  try {

    const tts = await ttsElevenlabs(text, jobId);

    const mp3AbsPath = tts.absMp3Path;

    // Convert mp3 -> wav (use jobId too)
    const wavAbsPath = path.join(
      process.cwd(),
      "public/media/tts",
      `${jobId}.wav`
    );

    await mp3ToWav(mp3AbsPath, wavAbsPath);

    // Rhubarb writes: public/media/lipsync/${jobId}.json
    const lipsync = await rhubarbLipsync(wavAbsPath, jobId);

    // cleanup wav
    await fs.unlink(wavAbsPath).catch(() => {});

    updateJob(jobId, {
      status: "done",
      audioUrl: tts.audioUrl,
      lipsync,
    });
  } catch (e: any) {
    updateJob(jobId, {
      status: "error",
      error: e?.message || "Voice job failed",
    });
  }
}