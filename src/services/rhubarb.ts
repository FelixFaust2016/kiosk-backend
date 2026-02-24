import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

export async function rhubarbLipsync(wavAbsPath: string, id: string) {
  const outJsonAbsPath = path.join(
    process.cwd(),
    "public/media/lipsync",
    `${id}.json`
  );

  await fs.mkdir(path.dirname(outJsonAbsPath), { recursive: true });

  // Option A: keep rhubarb inside repo
  const isWin = process.platform === "win32";
  const rhubarbBin = path.join(
    process.cwd(),
    "tools",
    "rhubarb",
    isWin ? "rhubarb.exe" : "rhubarb"
  );

  await new Promise<void>((resolve, reject) => {
    const p = spawn(rhubarbBin, [
      "-r",
      "phonetic",
      "-f",
      "json",
      "-o",
      outJsonAbsPath,
      wavAbsPath,
    ]);

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));

    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Rhubarb failed (${code}): ${stderr}`));
    });
  });

  const jsonText = await fs.readFile(outJsonAbsPath, "utf8");
  return JSON.parse(jsonText) as {
    mouthCues: Array<{ start: number; end: number; value: string }>;
  };
}
