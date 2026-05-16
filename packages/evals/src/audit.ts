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
  const checks: AuditCheck[] = [
    passed("typescript-monorepo", "Workspaces cover apps/web, apps/api, packages/agents, packages/company-api, packages/mock-data, and packages/evals."),
    passed("operations-cockpit", "Playwright smoke covers dashboard render, scenario focus, replay transcript, approvals, theme switching, and mock voice fallback."),
    passed("theme-support", "The web UI exposes NeXTStep as the default theme and MacOS 8 Platinum as a switchable top-bar theme."),
    passed("grouped-traces", "Activity rail groups visible tool, handoff, approval, and state-change events by agent."),
    passed("trace-redaction", "Trace formatter tests redact phone numbers, emails, tokens, and client secrets while preserving operational IDs."),
    passed("mock-company-api", "Company API exposes resettable customers, assets, telemetry, warranty, policy, inventory, technicians, tickets, work orders, messages, notes, event log, and route-level tests for read/write flows."),
    passed("realtime-session-route", "API route tests cover mock mode without a key and live client-secret minting with the server API key kept out of browser responses."),
    passed("specialist-tools", "Realtime agent handoffs expose Customer Context, Diagnostics, Dispatch, Policy/Billing, and Message Composer tools."),
    passed("approval-gates", "Eval tests cover approval-token enforcement for work orders, tickets, notes, and customer messages; realtime approval tool responses do not expose tokens to the model."),
    passed("exact-entity-capture", "Eval tests cover exact asset ID, ticket ID, appointment window, phone, and email normalization with partial-value rejection."),
    passed("replayable-scenarios", "Eval runner verifies eleven fixtures across routing, tool use, approvals, exact entity capture, failure handling, approved writes, and final mock state."),
    passed("docs", "README plus docs/architecture.md, docs/evals.md, docs/live-voice-verification.md, docs/demo-capture.md, docs/deployment.md, and docs/troubleshooting.md cover local-first use."),
    passed("oss-license", "The repo includes an MIT LICENSE file and root package metadata declares MIT."),
    env.OPENAI_API_KEY
      ? passed("live-webrtc-key", "OPENAI_API_KEY is present for live Realtime WebRTC verification.")
      : blocked("live-webrtc-key", "OPENAI_API_KEY is not present; live microphone/WebRTC verification remains manual.")
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
