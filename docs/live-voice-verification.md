# Live Voice Verification

Use this checklist when an OpenAI API key is available. The current automated suite verifies the mock voice fallback, scenario replay, approval drawer, exact-ID guardrails, browser UI, and automated live WebRTC connection path. The live smoke has passed in this workspace with a real server-side key loaded from ignored local environment. Strict completion still needs the spoken microphone/audio checklist below.

## Setup

Use `.env.example` as the reference, but pass the live key through the shell or your process manager. The API key must stay server-side.

~~~bash
OPENAI_API_KEY=<real-key> npm run dev:api
VITE_API_URL=http://localhost:8787 npm run dev:web
~~~

Open `http://localhost:5173`.

Both servers bind localhost by default. For a LAN-visible demo, run the API with `HOST=0.0.0.0` and pass `-- --host 0.0.0.0` to `npm run dev:web`.

## Automated Live Smoke

Run this when a real API key is available:

~~~bash
OPENAI_API_KEY=<real-key> npm run test:live
~~~

Use a real server-side OpenAI API key. The preflight blocks missing, test, or placeholder values before launching Chromium.

The live smoke starts isolated API/web servers, grants microphone permission to Chromium, clicks **Connect voice**, verifies that the console reaches `live` / `WebRTC` status with the live connection transcript, and sends one dispatcher text turn through the connected realtime session. This automated smoke has passed in the current workspace. It does not replace the spoken-audio checklist below.

## Expected Checks

1. Click **Connect voice**.
2. Browser asks for microphone permission.
3. Status changes to `live`.
4. Assistant transcript says the live voice session connected.
5. Speak: "Customer Amelia Brooks says charger C H G dash 8821 died after a power outage."
6. Agent asks to confirm exact ID if needed before lookup.
7. Activity rail shows customer, asset, telemetry, warranty, inventory, dispatch, and approval events.
8. Approval drawer receives a pending write action before any work order, cancellation, refund, reservation, save, or send mutates mock state.
9. Approving the card updates the mock state and event rail.
10. Disconnect returns status to `disconnected`.
11. After the smoke test and spoken checklist both pass, run:

~~~bash
LIVE_VOICE_VERIFIED=1 npm run audit:strict
~~~

## Failure Notes

- If the endpoint returns mock mode, the API server does not have `OPENAI_API_KEY`.
- If the browser never prompts for a microphone, check browser permissions for `localhost:5173`.
- If the agent claims a write completed before the event rail shows a successful tool result, treat it as a bug.
- If an exact ID is partial or corrected mid-utterance and a lookup still runs, treat it as a bug.
