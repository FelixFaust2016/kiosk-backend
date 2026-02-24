import crypto from "crypto";

export type Lipsync = { mouthCues: Array<{ start: number; end: number; value: string }> };

export type AvatarJobStatus = "queued" | "working" | "done" | "error";

export type AvatarJob = {
  id: string;
  status: AvatarJobStatus;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  
  audioUrl?: string;
  lipsync?: Lipsync;
  error?: string;
};

const jobs = new Map<string, AvatarJob>();

export function createJob(sessionId: string) {
  const id = crypto.randomBytes(10).toString("hex");
  const now = Date.now();

  const job: AvatarJob = {
    id,
    sessionId,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(id, job);
  return job;
}

export function getJob(id: string) {
  return jobs.get(id) || null;
}

export function updateJob(id: string, patch: Partial<AvatarJob>) {
  const job = jobs.get(id);
  if (!job) return null;
  const updated: AvatarJob = { ...job, ...patch, updatedAt: Date.now() };
  jobs.set(id, updated);
  return updated;
}