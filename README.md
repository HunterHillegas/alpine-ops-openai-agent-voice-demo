# Alpine FieldOps Voice Console

Alpine FieldOps Voice Console is an OSS TypeScript demo for a fictional EV-charger and solar-battery field-service company. It shows the shape of a realtime browser voice agent with a credible operations cockpit, resettable company data, specialist-agent boundaries, approval gates, and a visible tool/activity trace.

No real CRM, SMS, calendar, billing, inventory, refund, or dispatch systems are connected. All data and side effects are mocked and resettable.

## What It Demonstrates

- React/Vite operations cockpit with voice controls, switchable NeXTStep and MacOS 8 Platinum themes, live/replay transcript, customer/asset cards, telemetry, service timeline, work-order plan, approval drawer, and agent activity rail.
- Fastify mock company API with deterministic fixtures, service history, diagnostics, firmware checks, repair plans, read/write endpoints, approval-token enforcement, event log, scenario replay, and reset.
- TypeScript packages for mock data, typed company API, agent/tool definitions, and eval fixtures.
- Realtime session endpoint that keeps `OPENAI_API_KEY` server-side. Without a key it returns mock mode so the visual demo still runs.
- Guardrail examples for exact asset IDs and approval-gated write actions.

## Quick Start

~~~bash
npm install
npm run dev
~~~

Open the web app at `http://localhost:5173`. The API runs at `http://localhost:8787`.

Optional live realtime credentials:

~~~bash
OPENAI_API_KEY=<real-key> npm run dev:api
~~~

The browser does not receive the API key. `apps/api` mints a realtime client secret at `POST /realtime/session`. See `.env.example` for the full environment reference; scripts read process environment variables from the shell or deployment host.

## Demo Script

### 0:00 Launch

Open the dashboard. Point out Alpine FieldOps, connection state, model indicator, default NeXTStep theme, MacOS 8 Platinum theme option, seeded scenario picker, reset button, and replay button.

### 0:20 Start Voice Session

Click **Connect voice**. With no API key, the UI enters mock mode. With `OPENAI_API_KEY`, the API returns a realtime session credential for the browser WebRTC wiring. The default live mode starts muted; click **Open mic** before speaking. The text fallback input can also run seeded replay flows without a microphone.

### 0:40 Main Request

Load **Dead charger after outage**. The scenario prompt is:

> Customer Amelia Brooks says charger C H G dash 8821 died after a power outage. Check warranty, recent telemetry, likely fix, and earliest certified tech with the right part.

### 1:10 Tools And Agents

Click **Run replay**. The transcript panel plays the seeded dispatcher/assistant exchange while the activity rail shows exact-ID confirmation, customer lookup, service history, asset lookup, telemetry, known-issue matching, firmware check, repair-plan estimate, warranty check, inventory check, technician search, approval request, and summary.

### 1:40 Approval

Use the bottom approval drawer to approve the proposed work order. The mock API then creates the work order, reserves the listed part, updates the ticket, drafts the customer SMS, and queues follow-up approvals to save and mock-send the message.

### 2:00 Customer Message

Approve the customer-message card to save the grounded follow-up text, then approve the mocked send card. No real SMS is sent.

### 2:25 Summary

Review the final dispatch summary and event trace. The UI displays tool names, normalized arguments, approval status, result summaries, internal notes/summaries, and failures; it does not display private reasoning.

### 2:45 Safety Demo

Load **Refund and cancellation guardrail** and run replay. The agent requests approval before cancellation/refund work and does not claim completion before a write succeeds.

## Monorepo Layout

~~~text
apps/web              React/Vite operations cockpit
apps/api              Fastify mock API and realtime session endpoint
packages/agents       Agent roster, realtime instructions, tool schemas, exact-ID helpers
packages/company-api  In-memory fake company API with approval-gated writes
packages/mock-data    Seed fixtures and shared domain types
packages/evals        Eval fixtures and behavior tests
docs                  Architecture, scenarios, evals, demo capture, live verification, troubleshooting
~~~

## Gates

~~~bash
npm run typecheck
npm test
npm run evals
npm run audit
npm run test:ui
npm run test:live
npm run test:all
npm run build
npm run docs:list
~~~

`npm run evals` prints a JSON report for the scripted fixtures and writes `packages/evals/results/latest.json` for local inspection. `npm run audit` prints a completion-audit report and marks live checks as blocked until an API key, automated live-smoke evidence, and spoken checklist marker are present; use `npm run audit:strict` after the live checklist passes. `npm run test:ui` starts fresh smoke servers on API port `8788` and web port `5174`, then verifies the dashboard render, main scenario replay, approval execution, mock voice fallback, text fallback replay, unclear-ID guardrail, and Platinum desktop chrome in Chromium. `npm run test:all` runs the local non-live gate set. `npm run test:live` requires `OPENAI_API_KEY`, verifies that the browser reaches a live WebRTC session, and writes ignored live-smoke evidence. After manually completing the spoken checklist, run `LIVE_VOICE_VERIFIED=1 npm run verify:live-audio` to persist the ignored spoken-checklist marker for strict audits.

## Current Voice Status

The repo has the server-side realtime session endpoint, a lazy-loaded browser `RealtimeAgent` / `RealtimeSession` wrapper, specialist handoffs, and function tools that call the mock API. Without an API key, **Connect voice** enters mock mode. With `OPENAI_API_KEY` on the API server, the browser uses the ephemeral client secret to connect over WebRTC.

Automated live WebRTC smoke has passed in this workspace with a real server-side key loaded from ignored local environment. Local tests also cover realtime session credential minting, mock voice fallback, transcript event handling, approval refresh events, mic mute control, and interruption/error surfacing. Strict completion still requires the spoken microphone/audio checklist in `docs/live-voice-verification.md`; after that passes, run `LIVE_VOICE_VERIFIED=1 npm run verify:live-audio` and `npm run audit:strict` with the same server-side key loaded.

See `docs/scenarios.md` for replay/eval scenario coverage, `docs/live-voice-verification.md` for the manual live-key checklist, `docs/demo-capture.md` for screenshot/GIF capture steps, and `docs/deployment.md` for optional Vercel/Render notes.

## Mocking Boundary

All company data, telemetry, ticket updates, work orders, part reservations, customer messages, cancellations, and credit memos are fake. Reset restores seeded data. Approval tokens are local mock tokens only.

## License

MIT. See [LICENSE](./LICENSE).
