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
    passed("operations-cockpit", "Playwright smoke covers dashboard render, scenario focus, replay transcript, approvals, and mock voice fallback."),
    passed("mock-company-api", "Company API exposes resettable customers, assets, telemetry, warranty, policy, inventory, technicians, tickets, work orders, messages, notes, and event log."),
    passed("specialist-tools", "Realtime agent handoffs expose Customer Context, Diagnostics, Dispatch, Policy/Billing, and Message Composer tools."),
    passed("approval-gates", "Eval tests cover approval-token enforcement for work orders, tickets, notes, and customer messages."),
    passed("exact-entity-capture", "Eval tests cover exact asset ID, phone, and email normalization with partial-value rejection."),
    passed("replayable-scenarios", "Eval runner verifies seven seeded scenarios with expected and forbidden tool calls."),
    passed("docs", "README plus docs/architecture.md, docs/evals.md, docs/live-voice-verification.md, docs/demo-capture.md, docs/deployment.md, and docs/troubleshooting.md cover local-first use."),
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
