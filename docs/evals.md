# Evals

The first eval package is fixture-driven and focuses on hard behavioral boundaries:

- Routing: warranty to Policy/Billing, telemetry to Diagnostics, scheduling to Dispatch.
- Tool use: lookup before update, telemetry before diagnosis, inventory before part reservation.
- Approvals: no write side effects before approval.
- Exact entity capture: no partial asset lookup.
- Failure handling: unknown IDs, out of stock, expired warranty, duplicate names.

Fixtures live in \`packages/evals/src/index.ts\`. Behavior tests live in \`packages/evals/src/evals.test.ts\`.

Run:

~~~bash
npm test
~~~

Next slice: add a scripted agent runner that executes each fixture through the realtime/tool orchestration layer and compares expected/forbidden tool calls plus final UI event labels.
