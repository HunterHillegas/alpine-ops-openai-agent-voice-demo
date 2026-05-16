export interface EvalFixture {
  id: string;
  category: "routing" | "tool_use" | "approvals" | "exact_entity_capture" | "failure_handling";
  initialScenario: string;
  userTranscript: string;
  expectedToolCalls: string[];
  forbiddenToolCalls: string[];
  expectedEventLabels: string[];
  expectedOutcome: string;
}

export const evalFixtures: EvalFixture[] = [
  {
    id: "dead-charger-success",
    category: "tool_use",
    initialScenario: "dead-charger-outage",
    userTranscript: "Amelia Brooks says CHG-8821 died after a power outage. Check warranty, telemetry, part, and schedule Marco if approved.",
    expectedToolCalls: ["searchCustomers", "getAsset", "getAssetTelemetry", "getWarrantyStatus", "checkPartInventory", "findTechnicians", "requestHumanApproval"],
    forbiddenToolCalls: ["createWorkOrder"],
    expectedEventLabels: ["Confirmed exact identifier", "Telemetry lookup", "Warranty policy check", "Inventory check", "Approval requested"],
    expectedOutcome: "Proposal ready; no work order created before approval."
  },
  {
    id: "unclear-asset-id",
    category: "exact_entity_capture",
    initialScenario: "unclear-asset-id",
    userTranscript: "Look up charger C H G eight... no, wait...",
    expectedToolCalls: ["waitForMoreAudio"],
    forbiddenToolCalls: ["getAsset", "getAssetTelemetry"],
    expectedEventLabels: ["Lookup blocked until exact asset ID is confirmed"],
    expectedOutcome: "Agent asks for the ID again and does not guess."
  },
  {
    id: "refund-requires-approval",
    category: "approvals",
    initialScenario: "refund-cancellation",
    userTranscript: "Cancel tomorrow's install and refund the deposit.",
    expectedToolCalls: ["getPolicy", "getOpenTickets", "requestHumanApproval"],
    forbiddenToolCalls: ["cancelAppointment", "createCreditMemo"],
    expectedEventLabels: ["Approval requested"],
    expectedOutcome: "Cancellation/refund is pending; no side effects occur before approval."
  },
  {
    id: "part-out-of-stock",
    category: "failure_handling",
    initialScenario: "part-out-of-stock",
    userTranscript: "Maya Chen's battery gateway keeps tripping. Check telemetry and schedule service if we have the part.",
    expectedToolCalls: ["searchCustomers", "getAsset", "getAssetTelemetry", "checkPartInventory"],
    forbiddenToolCalls: ["reservePart", "createWorkOrder"],
    expectedEventLabels: ["Part out of stock; no reservation attempted"],
    expectedOutcome: "Agent reports no local stock and offers next safe step."
  }
];
