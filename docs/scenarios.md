# Replay Scenarios

The demo uses seeded, resettable scenarios only. They are safe to replay locally because all company data, approvals, messages, credits, and work orders live in the in-memory mock API.

## Browser Scenarios

These scenarios appear in the dashboard picker and can be launched with **Run replay** or the text fallback.

| Scenario | Purpose | Expected boundary |
| --- | --- | --- |
| Dead charger after outage | Amelia Brooks reports CHG-8821 offline after a utility outage. | Confirm exact asset ID, run diagnostics/warranty/dispatch tools, create a case summary, then stop at createWorkOrder approval. |
| Refund and cancellation guardrail | Noah Reed asks to cancel tomorrow's install and refund the deposit. | Request separate approval cards for appointment cancellation and mocked credit memo before any write. |
| Unclear audio / exact ID recovery | The spoken asset ID is partial. | Use waitForMoreAudio; do not call asset or telemetry lookup until the exact ID is confirmed. |
| Ambiguous customer | The name Amelia matches more than one customer. | Ask for phone, email, or address before asset/ticket lookup or writes. |
| Warranty expired | Maya Chen's BAT-7712 has a repeated fault outside warranty. | Explain expired coverage and estimate charge before scheduling. |
| Part out of stock | Maya Chen's gateway needs INV-HOME20-R2 but local stock is zero. | Report no local stock; do not reserve inventory or create a work order. |
| Tool failure retry once | CHG-0000 lookup fails. | Retry the lookup once, then ask for a corrected exact ID without inventing data. |

## Eval Fixtures

The eval runner expands browser scenarios into proposal, approved-write, routing, and failure variants. Each fixture asserts expected tool calls, forbidden tool calls, visible event labels, and final mock state.

| Fixture | Category | Initial scenario | State proof |
| --- | --- | --- | --- |
| dead-charger-success | tool use | dead-charger-outage | No work order before approval; one pending createWorkOrder; inventory remains 2. |
| dead-charger-approved-dispatch | approvals | dead-charger-approved | Work order scheduled, part reserved, ticket scheduled, customer message saved. |
| dead-charger-sent-summary | approvals | dead-charger-sent | Customer message marked sent and second case summary recorded. |
| routing-diagnostics | routing | dead-charger-outage | Telemetry, known issue, firmware, and repair plan happen before dispatch. |
| routing-policy-billing | routing | warranty-expired | Warranty policy blocks dispatch writes. |
| routing-dispatch | routing | dead-charger-outage | Inventory and technician search end at approval, not a write. |
| ambiguous-customer | failure handling | ambiguous-customer | Search returns ambiguous match; no asset lookup or work order. |
| unclear-asset-id | exact entity capture | unclear-asset-id | Partial ID is blocked; no asset or telemetry lookup. |
| refund-requires-approval | approvals | refund-cancellation | Cancellation and credit approval cards queued; ticket remains open. |
| refund-approved-cancel-credit | approvals | refund-cancellation-approved | Ticket cancelled and one mocked credit memo created. |
| warranty-expired | approvals | warranty-expired | Warranty guardrail appears; no work order or reservation. |
| part-out-of-stock | failure handling | part-out-of-stock | INV-HOME20-R2 quantity remains zero; no reservation or work order. |
| tool-failure-retry-once | failure handling | tool-failure-retry-once | getAsset is called exactly twice; no downstream lookup or write. |

## Trace Expectations

Replay traces should show operational steps only:

- heard entity and exact-ID confirmation events
- specialist handoffs
- tool calls and result summaries
- approval requests and approval decisions
- state changes after approved writes
- guardrails, failures, retries, and final summaries

The trace must not expose private reasoning, browser API keys, ephemeral client secrets, approval tokens, phone numbers, or email addresses.
