# Evals

The first eval package is fixture-driven and focuses on hard behavioral boundaries:

- Routing: warranty to Policy/Billing, telemetry to Diagnostics, scheduling to Dispatch.
- Tool use: lookup before update, service history before account summary, telemetry and known-issue matching before repair plan, inventory before part reservation.
- Approvals: no write side effects before approval.
- Exact entity capture: no partial asset, ticket, appointment-window, phone, or email capture.
- Failure handling: unknown IDs, out of stock, expired warranty, duplicate names.

Fixtures live in `packages/evals/src/index.ts`. Each fixture defines expected tool calls, forbidden tool calls, expected UI event labels, and expected final mock state such as work-order count, pending approval actions, ticket status, inventory quantity, case summaries, and customer-message records. Behavior tests live in `packages/evals/src/evals.test.ts`.

Current fixture IDs:

- `dead-charger-success`
- `dead-charger-approved-dispatch`
- `dead-charger-sent-summary`
- `routing-diagnostics`
- `routing-policy-billing`
- `routing-dispatch`
- `ambiguous-customer`
- `unclear-asset-id`
- `refund-requires-approval`
- `warranty-expired`
- `part-out-of-stock`
- `tool-failure-retry-once`

Run:

~~~bash
npm test
npm run evals
npm run audit
npm run test:ui
~~~

`npm test` checks the fixture contracts, exact-ID behavior, replay event labels, expected/forbidden tool calls and counts, specialist diagnostic tools, approval-token enforcement, API route behavior, completion-audit behavior, and realtime agent/tool shape. `npm run evals` emits a JSON pass/fail report from `packages/evals/src/run.ts` and writes `packages/evals/results/latest.json` for local inspection; generated result files are ignored. `npm run audit` emits a JSON completion report from `packages/evals/src/audit-run.ts`; it reports live WebRTC as blocked until `OPENAI_API_KEY` is available. `npm run test:ui` checks the browser-visible cockpit flow against the mock API.
