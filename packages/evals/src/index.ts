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
    expectedToolCalls: ["searchCustomers", "getServiceHistory", "getAsset", "getAssetTelemetry", "getKnownIssuePatterns", "checkFirmwareStatus", "estimateRepairPlan", "getWarrantyStatus", "checkPartInventory", "findTechnicians", "createCaseSummary", "requestHumanApproval"],
    forbiddenToolCalls: ["createWorkOrder"],
    expectedEventLabels: ["Confirmed exact identifier", "Service history lookup", "Known issue pattern lookup", "Firmware status check", "Repair plan estimated", "Case summary created", "Approval requested"],
    expectedOutcome: "Proposal ready; no work order created before approval."
  },
  {
    id: "ambiguous-customer",
    category: "failure_handling",
    initialScenario: "ambiguous-customer",
    userTranscript: "Pull up Amelia and check her charger issue.",
    expectedToolCalls: ["searchCustomers"],
    forbiddenToolCalls: ["getAsset", "getAssetTelemetry", "createWorkOrder"],
    expectedEventLabels: ["Ambiguous customer match; ask for phone, email, or address"],
    expectedOutcome: "Agent asks for disambiguating detail before asset or ticket lookup."
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
    id: "warranty-expired",
    category: "approvals",
    initialScenario: "warranty-expired",
    userTranscript: "Maya Chen's BAT-7712 is tripping again. Check warranty before proposing dispatch.",
    expectedToolCalls: ["searchCustomers", "getAsset", "estimateRepairPlan", "getWarrantyStatus"],
    forbiddenToolCalls: ["createWorkOrder", "reservePart"],
    expectedEventLabels: ["Warranty expired; estimate customer charge before scheduling"],
    expectedOutcome: "Agent explains expired warranty and estimates charge before any scheduling proposal."
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
  },
  {
    id: "tool-failure-retry-once",
    category: "failure_handling",
    initialScenario: "tool-failure-retry-once",
    userTranscript: "Check charger CHG-0000 and retry if the lookup fails.",
    expectedToolCalls: ["getAsset"],
    forbiddenToolCalls: ["getAssetTelemetry", "createWorkOrder", "reservePart"],
    expectedEventLabels: ["Asset lookup failed; ask for corrected exact ID"],
    expectedOutcome: "Agent reports the failed lookup and asks for corrected exact ID."
  }
];
