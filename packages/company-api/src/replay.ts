import { event, type CompanyState, type EventLogEntry } from "@alpine/mock-data";
import type { CompanyApi } from "./index";

export function replayDemoScenario(
  api: CompanyApi,
  scenarioId: string,
  addEvent: (entry: EventLogEntry) => EventLogEntry
): CompanyState {
  api.reset(scenarioId);
  if (scenarioId === "dead-charger-outage") replayDeadCharger(api, addEvent);
  else if (scenarioId === "dead-charger-approved") replayApprovedDeadCharger(api, addEvent);
  else if (scenarioId === "refund-cancellation") replayRefundCancellation(api);
  else if (scenarioId === "unclear-asset-id") replayUnclearAssetId(addEvent);
  else if (scenarioId === "ambiguous-customer") replayAmbiguousCustomer(api, addEvent);
  else if (scenarioId === "warranty-expired") replayWarrantyExpired(api, addEvent);
  else if (scenarioId === "part-out-of-stock") replayPartOutOfStock(api, addEvent);
  else if (scenarioId === "tool-failure-retry-once") replayToolFailure(api, addEvent);
  return api.getState();
}

function replayDeadCharger(api: CompanyApi, addEvent: (entry: EventLogEntry) => EventLogEntry) {
  addEvent(event("Realtime Triage Agent", "heard_entity", "Heard asset ID candidate: CHG-8821", { args: { candidate: "CHG-8821" } }));
  addEvent(event("Realtime Triage Agent", "confirmation", "Confirmed exact identifier", { args: { assetId: "CHG-8821" } }));
  addEvent(event("Realtime Triage Agent", "handoff", "Handoff to Customer Context Agent", { handoffTarget: "Customer Context Agent" }));
  api.searchCustomers("Amelia Brooks");
  api.getServiceHistory("cus_amelia_brooks");
  api.getAsset("CHG-8821");
  addEvent(event("Realtime Triage Agent", "handoff", "Handoff to Diagnostics Agent", { handoffTarget: "Diagnostics Agent" }));
  api.getAssetTelemetry("CHG-8821");
  api.getKnownIssuePatterns("AlpineCharge Pro 48A");
  api.checkFirmwareStatus("CHG-8821");
  api.estimateRepairPlan("CHG-8821");
  addEvent(event("Realtime Triage Agent", "handoff", "Handoff to Policy and Billing Agent", { handoffTarget: "Policy and Billing Agent" }));
  api.getWarrantyStatus("CHG-8821");
  addEvent(event("Realtime Triage Agent", "handoff", "Handoff to Dispatch Agent", { handoffTarget: "Dispatch Agent" }));
  api.checkPartInventory("PCB-48A-R3");
  api.findTechnicians({ certification: "charger_service", region: "Santa Barbara", partId: "PCB-48A-R3" });
  addEvent(event("Realtime Triage Agent", "handoff", "Handoff to Message Composer Agent", { handoffTarget: "Message Composer Agent" }));
  api.createCaseSummary({ ticketId: "TCK-1044" });
  api.requestHumanApproval({
    action: "createWorkOrder",
    summary: "Schedule Marco Diaz tomorrow 10:00-12:00 for warranty control-board replacement on CHG-8821.",
    payload: { ticketId: "TCK-1044", technicianId: "tech_marco_diaz", windowId: "win_marco_1012", reservedParts: ["PCB-48A-R3"], customerChargeCents: 0 }
  });
  addEvent(event("Realtime Triage Agent", "summary", "Ready for dispatcher approval: active warranty, likely control-board fault, Marco Diaz available tomorrow 10:00-12:00."));
}

function replayApprovedDeadCharger(api: CompanyApi, addEvent: (entry: EventLogEntry) => EventLogEntry) {
  replayDeadCharger(api, addEvent);
  const workOrderApproval = api.getState().approvals[0];
  if (!workOrderApproval) {
    addEvent(event("Safety / Approval Layer", "failure", "Approved replay missing work-order approval", { error: "approval_not_found" }));
    return;
  }
  api.approve(workOrderApproval.approvalId);
  const workOrder = api.createWorkOrder({
    ticketId: "TCK-1044",
    technicianId: "tech_marco_diaz",
    windowId: "win_marco_1012",
    reservedParts: ["PCB-48A-R3"],
    customerChargeCents: 0,
    approvalToken: workOrderApproval.token
  });

  const partApproval = api.requestHumanApproval({
    action: "reservePart",
    summary: "Reserve one PCB-48A-R3 control board for Amelia Brooks's CHG-8821 warranty repair.",
    payload: { partId: "PCB-48A-R3", quantity: 1 }
  });
  api.approve(partApproval.approvalId);
  api.reservePart({ partId: "PCB-48A-R3", quantity: 1, approvalToken: partApproval.token });

  const workOrderId = workOrder.ok ? workOrder.data.workOrderId : "WO-pending";
  const draft = api.draftCustomerMessage({
    customerId: "cus_amelia_brooks",
    workOrderId,
    channel: "sms",
    topic: "scheduled warranty repair"
  });
  const messageBody = draft.ok ? draft.data.body : "Alpine FieldOps scheduled your warranty repair.";
  const messageApproval = api.requestHumanApproval({
    action: "saveCustomerMessage",
    summary: "Save Amelia Brooks customer SMS draft after dispatcher approval.",
    payload: { customerId: "cus_amelia_brooks", channel: "sms" }
  });
  api.approve(messageApproval.approvalId);
  api.saveCustomerMessage({
    customerId: "cus_amelia_brooks",
    channel: "sms",
    body: messageBody,
    approvalToken: messageApproval.token
  });
  addEvent(event("Realtime Triage Agent", "summary", "Approved dispatch complete: work order scheduled, part reserved, customer text saved."));
}

function replayRefundCancellation(api: CompanyApi) {
  api.getPolicy("cancellation-refund");
  api.getOpenTickets("cus_noah_reed");
  api.requestHumanApproval({
    action: "cancelAppointment",
    summary: "Cancel Noah Reed's pending install. Refund still requires a separate credit-memo approval.",
    payload: { ticketId: "TCK-1048" }
  });
}

function replayUnclearAssetId(addEvent: (entry: EventLogEntry) => EventLogEntry) {
  addEvent(event("Realtime Triage Agent", "heard_entity", "Heard partial asset ID: CHG-8...", { args: { candidate: "CHG-8" } }));
  addEvent(event("Realtime Triage Agent", "tool_call", "Waiting for complete asset ID", { toolName: "waitForMoreAudio", args: { reason: "partial spoken asset ID" } }));
  addEvent(event("Safety / Approval Layer", "guardrail", "Lookup blocked until exact asset ID is confirmed", { error: "Partial spoken ID" }));
}

function replayAmbiguousCustomer(api: CompanyApi, addEvent: (entry: EventLogEntry) => EventLogEntry) {
  const result = api.searchCustomers("Amelia");
  if (!result.ok) addEvent(event("Customer Context Agent", "failure", "Ambiguous customer match; ask for phone, email, or address", {
    toolName: "searchCustomers",
    args: { query: "Amelia" },
    error: result.message
  }));
}

function replayWarrantyExpired(api: CompanyApi, addEvent: (entry: EventLogEntry) => EventLogEntry) {
  api.searchCustomers("Maya Chen");
  api.getAsset("BAT-7712");
  api.estimateRepairPlan("BAT-7712");
  api.getWarrantyStatus("BAT-7712");
  addEvent(event("Policy and Billing Agent", "guardrail", "Warranty expired; estimate customer charge before scheduling", {
    args: { assetId: "BAT-7712" }
  }));
}

function replayPartOutOfStock(api: CompanyApi, addEvent: (entry: EventLogEntry) => EventLogEntry) {
  api.searchCustomers("Maya Chen");
  api.getAsset("BAT-7712");
  api.getAssetTelemetry("BAT-7712");
  api.checkPartInventory("INV-HOME20-R2");
  addEvent(event("Dispatch Agent", "failure", "Part out of stock; no reservation attempted", { toolName: "checkPartInventory", args: { partId: "INV-HOME20-R2" }, error: "quantity=0" }));
}

function replayToolFailure(api: CompanyApi, addEvent: (entry: EventLogEntry) => EventLogEntry) {
  const result = api.getAsset("CHG-0000");
  if (!result.ok) addEvent(event("Customer Context Agent", "failure", "Asset lookup failed; ask for corrected exact ID", {
    toolName: "getAsset",
    args: { assetId: "CHG-0000" },
    error: result.message
  }));
}
