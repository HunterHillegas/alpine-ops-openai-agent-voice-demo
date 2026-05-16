export interface EvalFixture {
  id: string;
  category: "routing" | "tool_use" | "approvals" | "exact_entity_capture" | "failure_handling";
  initialScenario: string;
  userTranscript: string;
  expectedToolCalls: string[];
  expectedToolCounts?: Record<string, number>;
  forbiddenToolCalls: string[];
  expectedEventLabels: string[];
  expectedState: {
    workOrderCount: number;
    pendingApprovalActions: string[];
    approvedApprovalActions?: string[];
    caseSummaryCount?: number;
    customerMessageCount?: number;
    customerMessageStatuses?: string[];
    inventoryQuantities?: Record<string, number>;
    ticketStatuses?: Record<string, string>;
  };
  expectedOutcome: string;
}

const deadChargerProposalState: EvalFixture["expectedState"] = {
  workOrderCount: 0,
  pendingApprovalActions: ["createWorkOrder"],
  caseSummaryCount: 1,
  customerMessageCount: 0,
  inventoryQuantities: { "PCB-48A-R3": 2 },
  ticketStatuses: { "TCK-1044": "open" }
};

const noWriteState: EvalFixture["expectedState"] = {
  workOrderCount: 0,
  pendingApprovalActions: [],
  caseSummaryCount: 0,
  customerMessageCount: 0
};

export const evalFixtures: EvalFixture[] = [
  {
    id: "dead-charger-success",
    category: "tool_use",
    initialScenario: "dead-charger-outage",
    userTranscript: "Amelia Brooks says CHG-8821 died after a power outage. Check warranty, telemetry, part, and schedule Marco if approved.",
    expectedToolCalls: ["searchCustomers", "getServiceHistory", "getAsset", "getAssetTelemetry", "getKnownIssuePatterns", "checkFirmwareStatus", "estimateRepairPlan", "getWarrantyStatus", "checkPartInventory", "findTechnicians", "createCaseSummary", "requestHumanApproval"],
    forbiddenToolCalls: ["createWorkOrder"],
    expectedEventLabels: ["Confirmed exact identifier", "Service history lookup", "Known issue pattern lookup", "Firmware status check", "Repair plan estimated", "Case summary created", "Approval requested"],
    expectedState: deadChargerProposalState,
    expectedOutcome: "Proposal ready; no work order created before approval."
  },
  {
    id: "dead-charger-approved-dispatch",
    category: "approvals",
    initialScenario: "dead-charger-approved",
    userTranscript: "Approve the CHG-8821 warranty dispatch, reserve the PCB-48A-R3 board, and save the customer text.",
    expectedToolCalls: ["requestHumanApproval", "createWorkOrder", "draftCustomerMessage", "saveCustomerMessage"],
    forbiddenToolCalls: ["sendCustomerMessage"],
    expectedEventLabels: ["Approval granted", "Work order created", "Part reserved", "Customer message drafted", "Customer message saved"],
    expectedState: {
      workOrderCount: 1,
      pendingApprovalActions: [],
      approvedApprovalActions: ["createWorkOrder", "saveCustomerMessage"],
      caseSummaryCount: 1,
      customerMessageCount: 1,
      inventoryQuantities: { "PCB-48A-R3": 1 },
      ticketStatuses: { "TCK-1044": "scheduled" }
    },
    expectedOutcome: "Approved dispatch creates a work order, reserves the part, and saves the customer message."
  },
  {
    id: "dead-charger-sent-summary",
    category: "approvals",
    initialScenario: "dead-charger-sent",
    userTranscript: "Approve sending the Amelia Brooks dispatch text and produce the final case summary.",
    expectedToolCalls: ["createWorkOrder", "saveCustomerMessage", "sendCustomerMessage", "createCaseSummary"],
    forbiddenToolCalls: [],
    expectedEventLabels: ["Customer message sent", "Case summary created", "Approved dispatch closed: customer text sent and final summary recorded."],
    expectedState: {
      workOrderCount: 1,
      pendingApprovalActions: [],
      approvedApprovalActions: ["createWorkOrder", "saveCustomerMessage", "sendCustomerMessage"],
      caseSummaryCount: 2,
      customerMessageCount: 1,
      customerMessageStatuses: ["sent"],
      inventoryQuantities: { "PCB-48A-R3": 1 },
      ticketStatuses: { "TCK-1044": "scheduled" }
    },
    expectedOutcome: "Full approval flow sends the mock customer message and records a final case summary."
  },
  {
    id: "routing-diagnostics",
    category: "routing",
    initialScenario: "dead-charger-outage",
    userTranscript: "CHG-8821 failed after an outage. Route telemetry and firmware symptoms to diagnostics.",
    expectedToolCalls: ["getAssetTelemetry", "getKnownIssuePatterns", "checkFirmwareStatus", "estimateRepairPlan"],
    forbiddenToolCalls: ["createWorkOrder"],
    expectedEventLabels: ["Telemetry lookup", "Known issue pattern lookup", "Firmware status check", "Repair plan estimated"],
    expectedState: deadChargerProposalState,
    expectedOutcome: "Telemetry and failure analysis are handled by the Diagnostics Agent before dispatch."
  },
  {
    id: "routing-policy-billing",
    category: "routing",
    initialScenario: "warranty-expired",
    userTranscript: "Maya Chen's BAT-7712 is failing. Route warranty and charge policy before scheduling.",
    expectedToolCalls: ["getWarrantyStatus"],
    forbiddenToolCalls: ["createWorkOrder", "reservePart"],
    expectedEventLabels: ["Warranty policy check", "Warranty expired; estimate customer charge before scheduling"],
    expectedState: { ...noWriteState, ticketStatuses: { "TCK-1044": "open", "TCK-1048": "open" } },
    expectedOutcome: "Warranty and charge handling stay with Policy/Billing before any dispatch write."
  },
  {
    id: "routing-dispatch",
    category: "routing",
    initialScenario: "dead-charger-outage",
    userTranscript: "After CHG-8821 diagnostics, route part availability and technician windows to dispatch.",
    expectedToolCalls: ["checkPartInventory", "findTechnicians", "requestHumanApproval"],
    forbiddenToolCalls: ["createWorkOrder"],
    expectedEventLabels: ["Inventory check", "Qualified technician search", "Approval requested"],
    expectedState: deadChargerProposalState,
    expectedOutcome: "Part and technician planning is handled by Dispatch, ending at approval instead of a write."
  },
  {
    id: "ambiguous-customer",
    category: "failure_handling",
    initialScenario: "ambiguous-customer",
    userTranscript: "Pull up Amelia and check her charger issue.",
    expectedToolCalls: ["searchCustomers"],
    forbiddenToolCalls: ["getAsset", "getAssetTelemetry", "createWorkOrder"],
    expectedEventLabels: ["Ambiguous customer match; ask for phone, email, or address"],
    expectedState: { ...noWriteState, ticketStatuses: { "TCK-1044": "open", "TCK-1048": "open" } },
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
    expectedState: { ...noWriteState, ticketStatuses: { "TCK-1044": "open", "TCK-1048": "open" } },
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
    expectedState: { ...noWriteState, pendingApprovalActions: ["cancelAppointment"], ticketStatuses: { "TCK-1048": "open" } },
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
    expectedState: { ...noWriteState, ticketStatuses: { "TCK-1044": "open", "TCK-1048": "open" } },
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
    expectedState: { ...noWriteState, inventoryQuantities: { "INV-HOME20-R2": 0 } },
    expectedOutcome: "Agent reports no local stock and offers next safe step."
  },
  {
    id: "tool-failure-retry-once",
    category: "failure_handling",
    initialScenario: "tool-failure-retry-once",
    userTranscript: "Check charger CHG-0000 and retry if the lookup fails.",
    expectedToolCalls: ["getAsset"],
    expectedToolCounts: { getAsset: 2 },
    forbiddenToolCalls: ["getAssetTelemetry", "createWorkOrder", "reservePart"],
    expectedEventLabels: ["Asset lookup failed; retry once", "Asset lookup retry failed; ask for corrected exact ID"],
    expectedState: { ...noWriteState, ticketStatuses: { "TCK-1044": "open", "TCK-1048": "open" } },
    expectedOutcome: "Agent retries the failed lookup once, then asks for a corrected exact ID."
  }
];
