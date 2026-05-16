import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const liveAudioChecklistResultPath = resolve("packages/evals/results/live-audio-checklist.json");

export interface LiveAudioChecklistEvidence {
  ok: boolean;
  evidence: string;
}

export function readLiveAudioChecklistEvidence(env: NodeJS.ProcessEnv = process.env, path = env.LIVE_AUDIO_CHECKLIST_RESULT_PATH ?? liveAudioChecklistResultPath): LiveAudioChecklistEvidence {
  if (env.LIVE_VOICE_VERIFIED === "1") {
    return { ok: true, evidence: "LIVE_VOICE_VERIFIED=1 indicates the spoken microphone/audio checklist passed in this environment." };
  }

  if (!existsSync(path)) {
    return { ok: false, evidence: "Complete the spoken microphone checklist, then set LIVE_VOICE_VERIFIED=1 or record the ignored checklist evidence marker." };
  }

  try {
    const marker = JSON.parse(readFileSync(path, "utf8")) as { status?: unknown; checked?: unknown; generatedAt?: unknown };
    if (marker.status === "passed" && marker.checked === "live-audio-checklist") {
      const suffix = typeof marker.generatedAt === "string" ? " at " + marker.generatedAt : "";
      return { ok: true, evidence: "Spoken microphone/audio checklist marker recorded" + suffix + "." };
    }
  } catch {
    return { ok: false, evidence: "Spoken microphone checklist marker is unreadable. Re-run the checklist before strict audit." };
  }

  return { ok: false, evidence: "Spoken microphone checklist marker is invalid. Re-run the checklist before strict audit." };
}

export function writeLiveAudioChecklistEvidence(env: NodeJS.ProcessEnv = process.env, path = env.LIVE_AUDIO_CHECKLIST_RESULT_PATH ?? liveAudioChecklistResultPath) {
  if (env.LIVE_VOICE_VERIFIED !== "1") {
    throw new Error("Set LIVE_VOICE_VERIFIED=1 only after the spoken microphone/audio checklist passes.");
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    status: "passed",
    checked: "live-audio-checklist",
    generatedAt: new Date().toISOString()
  }, null, 2) + "\n");
}

if (process.argv.includes("--write")) {
  try {
    const path = process.env.LIVE_AUDIO_CHECKLIST_RESULT_PATH ?? liveAudioChecklistResultPath;
    writeLiveAudioChecklistEvidence(process.env, path);
    console.log("Wrote " + path);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
