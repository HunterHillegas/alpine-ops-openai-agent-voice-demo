import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const liveSmokeResultPath = resolve("packages/evals/results/live-smoke.json");

export interface LiveSmokeEvidence {
  ok: boolean;
  evidence: string;
}

export function readLiveSmokeEvidence(env: NodeJS.ProcessEnv = process.env, path = env.LIVE_WEBRTC_SMOKE_RESULT_PATH ?? liveSmokeResultPath): LiveSmokeEvidence {
  if (env.LIVE_WEBRTC_SMOKE_VERIFIED === "1") {
    return { ok: true, evidence: "LIVE_WEBRTC_SMOKE_VERIFIED=1 indicates npm run test:live passed in this environment." };
  }

  if (!existsSync(path)) {
    return { ok: false, evidence: "Run npm run test:live to create the ignored live smoke evidence marker." };
  }

  try {
    const marker = JSON.parse(readFileSync(path, "utf8")) as { status?: unknown; checked?: unknown; generatedAt?: unknown };
    if (marker.status === "passed" && marker.checked === "live-webrtc-smoke") {
      const suffix = typeof marker.generatedAt === "string" ? ` at ${marker.generatedAt}` : "";
      return { ok: true, evidence: `npm run test:live passed and wrote live smoke evidence${suffix}.` };
    }
  } catch {
    return { ok: false, evidence: "Live smoke evidence marker is unreadable. Re-run npm run test:live." };
  }

  return { ok: false, evidence: "Live smoke evidence marker is invalid. Re-run npm run test:live." };
}

export function writeLiveSmokeEvidence(path = liveSmokeResultPath) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    status: "passed",
    checked: "live-webrtc-smoke",
    generatedAt: new Date().toISOString()
  }, null, 2) + "\n");
  console.log(`Wrote ${path}`);
}

if (process.argv.includes("--write")) writeLiveSmokeEvidence();
