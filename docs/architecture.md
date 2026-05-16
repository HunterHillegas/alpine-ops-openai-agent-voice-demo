# Architecture

## Runtime Shape

Alpine FieldOps uses a small TypeScript monorepo:

- \`apps/web\`: browser cockpit, scenario controls, transcript, approvals, and trace UI.
- \`apps/api\`: Fastify API for mock company operations plus realtime session credential creation.
- \`packages/mock-data\`: source of truth for deterministic fixtures and shared types.
- \`packages/company-api\`: in-memory business logic, approval-token enforcement, writes, and event logging.
- \`packages/agents\`: realtime instructions, specialist roster, tool contracts, and exact-ID normalization.
- \`packages/evals\`: scripted fixtures that assert tool use, approval, exact-ID, and failure behavior.

## Voice Integration

The intended live path is OpenAI Agents SDK realtime in the browser:

1. Browser requests \`POST /realtime/session\`.
2. API uses server-side \`OPENAI_API_KEY\` to create an ephemeral realtime credential.
3. Browser starts a \`RealtimeSession\` with the client secret.
4. Function tools call the mock company API.
5. Tool calls, handoffs, approvals, and results append to the event rail.

The current implementation includes step 1 and 2. Without an API key, the endpoint returns mock mode so the demo shell remains usable.

## Approval Boundary

Read tools run once exact required fields are known. Write tools require:

1. Spoken/user confirmation.
2. \`requestHumanApproval\`.
3. UI approval card approval.
4. Approved token passed to the write endpoint.
5. Successful write response before the assistant claims completion.

Approval-gated writes include work-order creation, part reservation, appointment cancellation, credit memo creation, and customer-message send.

## Trace Events

The event log stores user-visible operational trace only:

- heard entity candidates
- exact-ID confirmation
- tool calls and results
- handoffs
- guardrails
- approval requests and decisions
- state changes
- failures and retries
- final summaries

It intentionally excludes private reasoning.
