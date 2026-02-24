import path from "path";
import { spawn } from "child_process";

export async function mp3ToWav(mp3Abs: string, wavAbs: string) {
  const ffmpegPath = path.join(process.cwd(), "tools", "ffmpeg", "ffmpeg.exe");

  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegPath, [
      "-y",
      "-i",
      mp3Abs,
      "-ar",
      "48000",
      "-ac",
      "1",
      wavAbs,
    ]);

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));

    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr}`));
    });
  });
}
