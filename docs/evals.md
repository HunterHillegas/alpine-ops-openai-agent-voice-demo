# Evals

The first eval package is fixture-driven and focuses on hard behavioral boundaries:

- Routing: warranty to Policy/Billing, telemetry to Diagnostics, scheduling to Dispatch.
- Tool use: lookup before update, service history before account summary, telemetry and known-issue matching before repair plan, inventory before part reservation.
- Approvals: no write side effects before approval.
- Exact entity capture: no partial asset lookup.
- Failure handling: unknown IDs, out of stock, expired warranty, duplicate names.

Fixtures live in `packages/evals/src/index.ts`. Behavior tests live in `packages/evals/src/evals.test.ts`.

Current fixture IDs:

- `dead-charger-success`
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

`npm test` checks the fixture contracts, exact-ID behavior, replay event labels, expected/forbidden tool calls, specialist diagnostic tools, approval-token enforcement, completion-audit behavior, and realtime agent/tool shape. `npm run evals` emits a JSON pass/fail report from `packages/evals/src/run.ts`. `npm run audit` emits a JSON completion report from `packages/evals/src/audit-run.ts`; it reports live WebRTC as blocked until `OPENAI_API_KEY` is available. `npm run test:ui` checks the browser-visible cockpit flow against the mock API.
