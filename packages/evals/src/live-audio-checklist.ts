import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const liveAudioChecklistResultPath = resolve("packages/evals/results/live-audio-checklist.json");

export interface LiveAudioChecklistEvidence {
  ok: boolean;
  evidence: string;
}

type LiveAudioMarkerSource = "manual-spoken-checklist" | "automated-generated-speech";

export function readLiveAudioChecklistEvidence(env: NodeJS.ProcessEnv = process.env, path = env.LIVE_AUDIO_CHECKLIST_RESULT_PATH ?? liveAudioChecklistResultPath): LiveAudioChecklistEvidence {
  if (env.LIVE_VOICE_VERIFIED === "1") {
    return { ok: true, evidence: "LIVE_VOICE_VERIFIED=1 indicates the spoken microphone/audio checklist passed in this environment." };
  }

  if (!existsSync(path)) {
    return { ok: false, evidence: "Complete the spoken microphone checklist, then set LIVE_VOICE_VERIFIED=1 or record the ignored checklist evidence marker." };
  }

  try {
    const marker = JSON.parse(readFileSync(path, "utf8")) as { status?: unknown; checked?: unknown; generatedAt?: unknown; source?: unknown };
    if (marker.status === "passed" && marker.checked === "live-audio-checklist" && isKnownMarkerSource(marker.source)) {
      const suffix = typeof marker.generatedAt === "string" ? " at " + marker.generatedAt : "";
      const source = marker.source === "automated-generated-speech" ? "Generated-speech browser microphone check" : "Spoken microphone/audio checklist";
      return { ok: true, evidence: source + " marker recorded" + suffix + "." };
    }
  } catch {
    return { ok: false, evidence: "Spoken microphone checklist marker is unreadable. Re-run the checklist before strict audit." };
  }

  return { ok: false, evidence: "Spoken microphone checklist marker is invalid. Re-run the checklist before strict audit." };
}

export function writeLiveAudioChecklistEvidence(env: NodeJS.ProcessEnv = process.env, path = env.LIVE_AUDIO_CHECKLIST_RESULT_PATH ?? liveAudioChecklistResultPath, source: LiveAudioMarkerSource | null = null) {
  const markerSource = source ?? (env.LIVE_VOICE_VERIFIED === "1" ? "manual-spoken-checklist" : null);
  if (!markerSource) {
    throw new Error("Set LIVE_VOICE_VERIFIED=1 after the spoken checklist passes, or run npm run test:live-audio for automated generated-speech evidence.");
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    status: "passed",
    checked: "live-audio-checklist",
    source: markerSource,
    generatedAt: new Date().toISOString()
  }, null, 2) + "\n");
}

function isKnownMarkerSource(source: unknown): source is LiveAudioMarkerSource {
  return source === "manual-spoken-checklist" || source === "automated-generated-speech";
}

if (process.argv.includes("--write")) {
  try {
    const path = process.env.LIVE_AUDIO_CHECKLIST_RESULT_PATH ?? liveAudioChecklistResultPath;
    writeLiveAudioChecklistEvidence(process.env, path, process.argv.includes("--automated") ? "automated-generated-speech" : null);
    console.log("Wrote " + path);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
