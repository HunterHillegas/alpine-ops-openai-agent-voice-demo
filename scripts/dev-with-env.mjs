import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createDevRunner } from "./dev-runner.mjs";

export const LIVE_DEV_COMMANDS = [
  { name: "api", command: "npm", args: ["run", "start", "-w", "apps/api"] },
  { name: "web", command: "npm", args: ["run", "dev", "-w", "apps/web"] }
];

export function parseDotenv(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const assignment = line.startsWith("export ") ? line.slice(7).trimStart() : line;
    const equalsIndex = assignment.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = assignment.slice(0, equalsIndex).trim();
    const rawValue = assignment.slice(equalsIndex + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    values[key] = unquoteDotenvValue(rawValue);
  }

  return values;
}

export function loadDotenv(path = ".env", env = process.env) {
  const envPath = resolve(path);
  if (!existsSync(envPath)) {
    return { loaded: false, path: envPath, values: {} };
  }

  const values = parseDotenv(readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (env[key] === undefined) env[key] = value;
  }

  return { loaded: true, path: envPath, values };
}

function unquoteDotenvValue(value) {
  if (value.length < 2) return value;

  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) return stripInlineComment(value);

  const unquoted = value.slice(1, -1);
  if (quote === "'") return unquoted;

  return unquoted
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll("\\\"", '"')
    .replaceAll("\\\\", "\\");
}

function stripInlineComment(value) {
  const commentStart = value.search(/\s#/);
  return commentStart === -1 ? value : value.slice(0, commentStart).trimEnd();
}

export function validateLiveDevEnv(env = process.env) {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key || key === "sk-..." || key === "sk-test") {
    return {
      ok: false,
      message: "OPENAI_API_KEY is missing or still a placeholder. Add it to .env, then run npm run dev:live."
    };
  }

  return { ok: true };
}

export function startLiveDev({ env = process.env, envPath = ".env", runner = createDevRunner({ commands: LIVE_DEV_COMMANDS }), processRef = process } = {}) {
  const result = loadDotenv(envPath, env);
  const validation = validateLiveDevEnv(env);

  if (!validation.ok) {
    console.error(result.loaded ? "Loaded " + result.path + ", but " + validation.message : "Could not find " + result.path + ". " + validation.message);
    processRef.exit(1);
    return false;
  }

  const source = result.loaded ? "Loaded " + result.path : "No .env found at " + result.path + "; using existing process environment";
  console.log(source + ". Starting live dev server with OPENAI_API_KEY available to the API process.");
  runner.start();
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLiveDev();
}
