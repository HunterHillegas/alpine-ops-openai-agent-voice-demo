import { describe, expect, it } from "vitest";
import { validateLiveVoiceEnv } from "./live-voice-env";

describe("live voice environment validation", () => {
  it("blocks a missing OpenAI API key", () => {
    expect(validateLiveVoiceEnv({}).errors).toContain("OPENAI_API_KEY is missing.");
  });

  it("blocks placeholder keys before launching the live browser smoke", () => {
    expect(validateLiveVoiceEnv({ OPENAI_API_KEY: "sk-..." }).errors).toContain("OPENAI_API_KEY must be a real OpenAI API key, not the sk-... placeholder.");
    expect(validateLiveVoiceEnv({ OPENAI_API_KEY: "sk-test" }).errors).toContain("OPENAI_API_KEY must be a real OpenAI API key, not the sk-... placeholder.");
  });

  it("accepts a plausible server-side OpenAI API key shape", () => {
    expect(validateLiveVoiceEnv({ OPENAI_API_KEY: "sk-proj-examplelivekey123" })).toEqual({ ok: true, errors: [] });
  });
});
