import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const liveAudioFixturePath = process.env.LIVE_AUDIO_FIXTURE_PATH ?? "/tmp/alpine-fieldops-live-audio.wav";

const spokenPrompt = "Customer Amelia Brooks says charger C H G dash eight eight two one died after a power outage. Check warranty, recent telemetry, likely fix, and earliest certified tech with the right part.";

interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcm: Buffer;
}

async function generateSpeechWav() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required to generate the live audio fixture.");

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: spokenPrompt,
      response_format: "wav"
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI speech fixture generation failed: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function writeLiveAudioFixture(path = liveAudioFixturePath) {
  const wav = readPcmWav(await generateSpeechWav());
  const padded = addSilence(wav, { leadSeconds: 6, tailSeconds: 5 });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, padded);
  console.log(`Wrote ${path}`);
}

function readPcmWav(buffer: Buffer): WavData {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("OpenAI speech response was not a WAV file.");
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let pcm: Buffer | null = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;

    if (id === "fmt ") {
      const audioFormat = buffer.readUInt16LE(start);
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bitsPerSample = buffer.readUInt16LE(start + 14);
      if (audioFormat !== 1 || bitsPerSample !== 16 || channels !== 1) {
        throw new Error("Live audio fixture expects PCM 16-bit mono WAV output.");
      }
    }

    if (id === "data") pcm = buffer.subarray(start, end);

    offset = end + (size % 2);
  }

  if (!sampleRate || !pcm) throw new Error("WAV response did not include fmt and data chunks.");
  return { sampleRate, channels, bitsPerSample, pcm };
}

function addSilence(wav: WavData, options: { leadSeconds: number; tailSeconds: number }) {
  const bytesPerSample = wav.bitsPerSample / 8;
  const lead = Buffer.alloc(wav.sampleRate * wav.channels * bytesPerSample * options.leadSeconds);
  const tail = Buffer.alloc(wav.sampleRate * wav.channels * bytesPerSample * options.tailSeconds);
  return writePcmWav({
    ...wav,
    pcm: Buffer.concat([lead, wav.pcm, tail])
  });
}

function writePcmWav(wav: WavData) {
  const blockAlign = wav.channels * wav.bitsPerSample / 8;
  const byteRate = wav.sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + wav.pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(wav.channels, 22);
  header.writeUInt32LE(wav.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(wav.bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(wav.pcm.length, 40);
  return Buffer.concat([header, wav.pcm]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeLiveAudioFixture().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
