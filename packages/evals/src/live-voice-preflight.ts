import { validateLiveVoiceEnv } from "./live-voice-env";

const result = validateLiveVoiceEnv(process.env);

if (!result.ok) {
  console.error("Live voice verification cannot start:");
  for (const error of result.errors) console.error(`- ${error}`);
  console.error("Run with a real key: OPENAI_API_KEY=sk-... npm run test:live");
  process.exit(1);
}

console.log("Live voice preflight passed: OPENAI_API_KEY looks usable.");
