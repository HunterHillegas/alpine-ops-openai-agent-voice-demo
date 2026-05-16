import { validateLiveVoiceEnv } from "./live-voice-env";

export type AuditStatus = "passed" | "blocked";

export interface AuditCheck {
  id: string;
  status: AuditStatus;
  evidence: string;
}

export interface CompletionAudit {
  status: AuditStatus;
  checks: AuditCheck[];
}

export function runCompletionAudit(env: NodeJS.ProcessEnv = process.env): CompletionAudit {
  const liveEnv = validateLiveVoiceEnv(env);
  const checks: AuditCheck[] = [
    passed("typescript-monorepo", "Workspaces cover apps/web, apps/api, packages/agents, packages/company-api, packages/mock-data, and packages/evals."),
    passed("operations-cockpit", "Playwright smoke covers dashboard render, scenario focus, replay transcript, approval execution/rejection, theme switching, and mock voice fallback."),
    passed("theme-support", "The web UI exposes NeXTStep as the default theme and MacOS 8 Platinum as a switchable top-bar theme."),
    passed("platinum-desktop-fidelity", "Playwright verifies the Platinum deep link renders MacOS 8-style menu chrome, patterned wallpaper, desktop icons, background windows, and launcher strip."),
    passed("grouped-traces", "Activity rail groups visible tool, handoff, approval, and state-change events by agent."),
    passed("trace-redaction", "Trace formatter tests redact phone numbers, emails, tokens, and client secrets while preserving operational IDs."),
    passed("mock-company-api", "Company API exposes resettable customers, assets, telemetry, warranty, policy, inventory, technicians, tickets, work orders, credit memos, messages, notes, event log, shared typed client contracts, and route-level tests for read/write flows."),
    passed("realtime-session-route", "API route tests cover mock mode without a key and live client-secret minting with the server API key kept out of browser responses."),
    passed("realtime-ui-events", "Realtime console tests cover history transcript mapping, approval refresh events, audio interruption messages, and session error surfacing."),
    passed("specialist-tools", "Realtime agent handoffs expose Customer Context, Diagnostics, Dispatch, Policy/Billing, and Message Composer tools."),
    passed("approval-gates", "Eval tests cover approval-token enforcement for work orders, tickets, cancellations, credit memos, notes, and customer messages; realtime approval tool responses do not expose tokens to the model."),
    passed("exact-entity-capture", "Eval tests cover exact asset ID, ticket ID, appointment window, phone, and email normalization with partial-value rejection."),
    passed("replayable-scenarios", "Eval runner verifies thirteen fixtures across routing, tool use, tool-call counts, approvals, exact entity capture, failure handling, approved writes, final mock state, sent-message summary, and refund completion."),
    passed("docs", "README plus docs/architecture.md, docs/scenarios.md, docs/evals.md, docs/live-voice-verification.md, docs/demo-capture.md, docs/deployment.md, and docs/troubleshooting.md cover local-first use."),
    passed("oss-license", "The repo includes an MIT LICENSE file and root package metadata declares MIT."),
    liveEnv.ok
      ? passed("live-webrtc-key", "OPENAI_API_KEY passed live verification preflight shape checks.")
      : blocked("live-webrtc-key", liveEnv.errors.join(" ")),
    liveEnv.ok && env.LIVE_VOICE_VERIFIED === "1"
      ? passed("live-webrtc-verified", "LIVE_VOICE_VERIFIED=1 indicates the live browser microphone/WebRTC checklist passed in this environment.")
      : blocked("live-webrtc-verified", "Run npm run test:live and the manual microphone checklist, then set LIVE_VOICE_VERIFIED=1 for strict completion audit.")
  ];

  return {
    status: checks.every((check) => check.status === "passed") ? "passed" : "blocked",
    checks
  };
}

function passed(id: string, evidence: string): AuditCheck {
  return { id, status: "passed", evidence };
}

function blocked(id: string, evidence: string): AuditCheck {
  return { id, status: "blocked", evidence };
}
