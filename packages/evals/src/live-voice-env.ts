export interface LiveVoiceEnvResult {
  ok: boolean;
  errors: string[];
}

export function validateLiveVoiceEnv(env: NodeJS.ProcessEnv): LiveVoiceEnvResult {
  const errors: string[] = [];
  const key = env.OPENAI_API_KEY?.trim();

  if (!key) {
    errors.push("OPENAI_API_KEY is missing.");
  } else if (!looksLikeOpenAIApiKey(key)) {
    errors.push("OPENAI_API_KEY must be a real OpenAI API key, not the sk-... placeholder.");
  }

  return { ok: errors.length === 0, errors };
}

function looksLikeOpenAIApiKey(key: string) {
  return key.startsWith("sk-") && key.length >= 20 && !key.includes("...") && key !== "sk-test";
}
