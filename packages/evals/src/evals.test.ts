import { describe, expect, it } from "vitest";
import { normalizeSpokenAssetId, normalizeSpokenEmail, normalizeSpokenPhone, normalizeSpokenTicketId, normalizeSpokenWindowId, toolDefinitions } from "@alpine/agents";
import { createCompanyApi } from "@alpine/company-api";
import { runCompletionAudit } from "./audit";
import { evalFixtures } from "./index";
import { runEvalFixtures } from "./runner";

describe("eval fixtures", () => {
  it("cover the required demo categories", () => {
    expect(evalFixtures.map((fixture) => fixture.id)).toEqual([
      "dead-charger-success",
      "dead-charger-approved-dispatch",
      "routing-diagnostics",
      "routing-policy-billing",
      "routing-dispatch",
      "ambiguous-customer",
      "unclear-asset-id",
      "refund-requires-approval",
      "warranty-expired",
      "part-out-of-stock",
      "tool-failure-retry-once"
    ]);
  });

  it("covers every required eval category", () => {
    expect(new Set(evalFixtures.map((fixture) => fixture.category))).toEqual(new Set([
      "routing",
      "tool_use",
      "approvals",
      "exact_entity_capture",
      "failure_handling"
    ]));
  });

  it("defines final mock state expectations for every fixture", () => {
    for (const fixture of evalFixtures) {
      expect(fixture.expectedState, fixture.id).toMatchObject({
        workOrderCount: expect.any(Number),
        pendingApprovalActions: expect.any(Array)
      });
    }
  });

  it("marks write tools as approval-gated", () => {
    const writeTools = toolDefinitions.filter((tool) => tool.kind === "write");
    expect(writeTools.map((tool) => tool.name)).toEqual([
      "createTicket",
      "updateTicket",
      "createWorkOrder",
      "reservePart",
      "cancelAppointment",
      "createCreditMemo",
      "saveInternalNote",
      "saveCustomerMessage",
      "sendCustomerMessage"
    ]);
    expect(writeTools.every((tool) => tool.requiresApproval)).toBe(true);
  });

  it("normalizes exact spoken asset IDs conservatively", () => {
    expect(normalizeSpokenAssetId("C H G dash 8821")).toEqual({ status: "complete", assetId: "CHG-8821" });
    expect(normalizeSpokenAssetId("C H G eight... no wait").status).toBe("partial");
  });

  it("normalizes phone numbers and emails only when complete", () => {
    expect(normalizeSpokenPhone("805 555 0147")).toEqual({ status: "complete", phone: "+1-805-555-0147" });
    expect(normalizeSpokenPhone("805 555").status).toBe("partial");
    expect(normalizeSpokenEmail("amelia dot brooks at example dot test")).toEqual({ status: "complete", email: "amelia.brooks@example.test" });
    expect(normalizeSpokenEmail("amelia at example").status).toBe("partial");
  });

  it("normalizes ticket and appointment window identifiers conservatively", () => {
    expect(normalizeSpokenTicketId("ticket T C K dash 1044")).toEqual({ status: "complete", ticketId: "TCK-1044" });
    expect(normalizeSpokenTicketId("ticket ten forty four").status).toBe("partial");
    expect(normalizeSpokenWindowId("window Marco 1012")).toEqual({ status: "complete", windowId: "win_marco_1012" });
    expect(normalizeSpokenWindowId("tomorrow morning").status).toBe("partial");
  });

  it("does not create a work order during the replay before approval", () => {
    const api = createCompanyApi();
    const replay = api.replayScenario("dead-charger-outage");

    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.data.workOrders).toHaveLength(0);
    expect(replay.data.approvals[0]?.action).toBe("createWorkOrder");
  });

  it("replay scenarios emit their expected UI event labels", () => {
    for (const fixture of evalFixtures) {
      const api = createCompanyApi();
      const replay = api.replayScenario(fixture.initialScenario);

      expect(replay.ok, fixture.id).toBe(true);
      if (!replay.ok) continue;

      const labels = replay.data.events.map((event) => event.label);
      for (const expectedLabel of fixture.expectedEventLabels) {
        expect(labels, fixture.id).toContain(expectedLabel);
      }
    }
  });

  it("main replay emits visible specialist handoffs", () => {
    const api = createCompanyApi();
    const replay = api.replayScenario("dead-charger-outage");

    expect(replay.ok).toBe(true);
    if (!replay.ok) return;

    const handoffs = replay.data.events
      .filter((event) => event.type === "handoff")
      .map((event) => event.handoffTarget);

    expect(handoffs).toEqual([
      "Message Composer Agent",
      "Dispatch Agent",
      "Policy and Billing Agent",
      "Diagnostics Agent",
      "Customer Context Agent"
    ]);
  });

  it("replay scenarios honor expected and forbidden tool calls", () => {
    for (const fixture of evalFixtures) {
      const api = createCompanyApi();
      const replay = api.replayScenario(fixture.initialScenario);

      expect(replay.ok, fixture.id).toBe(true);
      if (!replay.ok) continue;

      const toolCalls = replay.data.events.flatMap((event) => event.toolName ? [event.toolName] : []);
      for (const expectedTool of fixture.expectedToolCalls) {
        expect(toolCalls, fixture.id).toContain(expectedTool);
      }
      for (const forbiddenTool of fixture.forbiddenToolCalls) {
        expect(toolCalls, fixture.id).not.toContain(forbiddenTool);
      }
    }
  });

  it("orders the main read-only investigation before approval requests", () => {
    const api = createCompanyApi();
    const replay = api.replayScenario("dead-charger-outage");

    expect(replay.ok).toBe(true);
    if (!replay.ok) return;

    const chronologicalTools = replay.data.events
      .slice()
      .reverse()
      .flatMap((event) => event.toolName ? [event.toolName] : []);

    expect(chronologicalTools.indexOf("searchCustomers")).toBeLessThan(chronologicalTools.indexOf("getAsset"));
    expect(chronologicalTools.indexOf("getAssetTelemetry")).toBeLessThan(chronologicalTools.indexOf("estimateRepairPlan"));
    expect(chronologicalTools.indexOf("checkPartInventory")).toBeLessThan(chronologicalTools.indexOf("requestHumanApproval"));
    expect(chronologicalTools).not.toContain("createWorkOrder");
  });

  it("scripted eval runner reports every fixture passing", () => {
    const results = runEvalFixtures();

    expect(results).toHaveLength(evalFixtures.length);
    expect(results.every((result) => result.passed)).toBe(true);
    expect(results.flatMap((result) => result.stateErrors)).toEqual([]);
  });

  it("completion audit reports live voice as blocked without an API key", () => {
    const audit = runCompletionAudit({});

    expect(audit.status).toBe("blocked");
    expect(audit.checks.find((check) => check.id === "live-webrtc-key")?.status).toBe("blocked");
  });

  it("completion audit passes when live voice key is available", () => {
    const audit = runCompletionAudit({ OPENAI_API_KEY: "sk-test" });

    expect(audit.status).toBe("passed");
    expect(audit.checks.every((check) => check.status === "passed")).toBe(true);
  });

  it("surfaces ambiguous customer matches without continuing to writes", () => {
    const api = createCompanyApi();
    const result = api.searchCustomers("Amelia");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ambiguous_customer");
    expect(result.matches).toHaveLength(2);
    expect(api.getState().workOrders).toHaveLength(0);
  });

  it("requires an approved token before writes mutate state", () => {
    const api = createCompanyApi();
    const denied = api.createWorkOrder({
      ticketId: "TCK-1044",
      technicianId: "tech_marco_diaz",
      windowId: "win_marco_1012",
      reservedParts: ["PCB-48A-R3"],
      customerChargeCents: 0,
      approvalToken: "missing"
    });

    expect(denied.ok).toBe(false);
    expect(api.getState().workOrders).toHaveLength(0);
  });

  it("requires approval before saving mocked customer messages", () => {
    const api = createCompanyApi();
    const deniedSave = api.saveCustomerMessage({
      customerId: "cus_amelia_brooks",
      channel: "sms",
      body: "Draft",
      approvalToken: "missing"
    });

    expect(deniedSave.ok).toBe(false);
    expect(api.getState().customerMessages).toHaveLength(0);
  });

  it("returns specialist diagnostic context for the main charger scenario", () => {
    const api = createCompanyApi();

    const history = api.getServiceHistory("cus_amelia_brooks");
    const patterns = api.getKnownIssuePatterns("AlpineCharge Pro 48A");
    const firmware = api.checkFirmwareStatus("CHG-8821");
    const plan = api.estimateRepairPlan("CHG-8821");
    const summary = api.createCaseSummary({ ticketId: "TCK-1044" });

    expect(history.ok && history.data[0]?.assetId).toBe("CHG-8821");
    expect(patterns.ok && patterns.data[0]?.likelyPartId).toBe("PCB-48A-R3");
    expect(firmware.ok && firmware.data.updateRecommended).toBe(true);
    expect(plan.ok && plan.data.likelyPartId).toBe("PCB-48A-R3");
    expect(summary.ok && summary.data.body).toContain("control-board failure");
  });

  it("creates and updates tickets only after approval", () => {
    const api = createCompanyApi();
    const denied = api.createTicket({
      customerId: "cus_amelia_brooks",
      assetId: "CHG-8821",
      priority: "high",
      summary: "Customer called back with outage details",
      approvalToken: "missing"
    });

    expect(denied.ok).toBe(false);
    expect(api.getState().tickets).toHaveLength(2);

    const createApproval = api.requestHumanApproval({
      action: "createTicket",
      summary: "Create follow-up charger outage ticket.",
      payload: {
        customerId: "cus_amelia_brooks",
        assetId: "CHG-8821",
        priority: "high",
        summary: "Customer called back with outage details"
      }
    });
    api.approve(createApproval.approvalId);

    const created = api.createTicket({
      customerId: "cus_amelia_brooks",
      assetId: "CHG-8821",
      priority: "high",
      summary: "Customer called back with outage details",
      approvalToken: createApproval.token
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(api.getState().tickets[0]?.ticketId).toBe(created.data.ticketId);

    const updateApproval = api.requestHumanApproval({
      action: "updateTicket",
      summary: "Mark new ticket triaged.",
      payload: { ticketId: created.data.ticketId, status: "triaged", note: "Exact ID confirmed." }
    });
    api.approve(updateApproval.approvalId);

    const updated = api.updateTicket({
      ticketId: created.data.ticketId,
      status: "triaged",
      note: "Exact ID confirmed.",
      approvalToken: updateApproval.token
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.status).toBe("triaged");
    expect(updated.data.notes).toContain("Exact ID confirmed.");
  });

  it("saves and sends mocked customer messages only after approval", () => {
    const api = createCompanyApi();
    const noteApproval = api.requestHumanApproval({
      action: "saveInternalNote",
      summary: "Save dispatch note.",
      payload: { ticketId: "TCK-1044", body: "Validated known issue pattern." }
    });
    api.approve(noteApproval.approvalId);

    const note = api.saveInternalNote({
      ticketId: "TCK-1044",
      body: "Validated known issue pattern.",
      approvalToken: noteApproval.token
    });
    expect(note.ok).toBe(true);
    expect(api.getState().internalNotes[0]?.body).toContain("known issue");

    const saveApproval = api.requestHumanApproval({
      action: "saveCustomerMessage",
      summary: "Save drafted customer SMS.",
      payload: { customerId: "cus_amelia_brooks", channel: "sms", body: "Repair scheduled." }
    });
    api.approve(saveApproval.approvalId);

    const saved = api.saveCustomerMessage({
      customerId: "cus_amelia_brooks",
      channel: "sms",
      body: "Repair scheduled.",
      approvalToken: saveApproval.token
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(api.getState().customerMessages[0]?.status).toBe("saved");

    const sendApproval = api.requestHumanApproval({
      action: "sendCustomerMessage",
      summary: "Mock-send saved customer SMS.",
      payload: { messageId: saved.data.messageId }
    });
    api.approve(sendApproval.approvalId);

    const sent = api.sendCustomerMessage({
      messageId: saved.data.messageId,
      approvalToken: sendApproval.token
    });

    expect(sent.ok).toBe(true);
    expect(api.getState().customerMessages[0]?.status).toBe("sent");
  });

  it("keeps rejected write approvals from mutating dispatch or billing state", () => {
    const api = createCompanyApi();
    const reserveApproval = api.requestHumanApproval({
      action: "reservePart",
      summary: "Reserve one control board.",
      payload: { partId: "PCB-48A-R3", quantity: 1 }
    });
    api.reject(reserveApproval.approvalId);

    const deniedReservation = api.reservePart({
      partId: "PCB-48A-R3",
      quantity: 1,
      approvalToken: reserveApproval.token
    });

    expect(deniedReservation.ok).toBe(false);
    expect(api.getState().inventory.find((part) => part.partId === "PCB-48A-R3")?.quantity).toBe(2);

    const cancelApproval = api.requestHumanApproval({
      action: "cancelAppointment",
      summary: "Cancel install after dispatcher confirmation.",
      payload: { ticketId: "TCK-1048" }
    });
    api.approve(cancelApproval.approvalId);
    const cancelled = api.cancelAppointment({ ticketId: "TCK-1048", approvalToken: cancelApproval.token });

    expect(cancelled.ok).toBe(true);
    expect(api.getState().tickets.find((ticket) => ticket.ticketId === "TCK-1048")?.status).toBe("cancelled");

    const creditApproval = api.requestHumanApproval({
      action: "createCreditMemo",
      summary: "Refund deposit after cancellation approval.",
      payload: { customerId: "cus_noah_reed", amountCents: 25000, reason: "Customer cancelled install before cutoff." }
    });
    api.approve(creditApproval.approvalId);
    const credit = api.createCreditMemo({
      customerId: "cus_noah_reed",
      amountCents: 25000,
      reason: "Customer cancelled install before cutoff.",
      approvalToken: creditApproval.token
    });

    expect(credit.ok).toBe(true);
    if (!credit.ok) return;
    expect(credit.data.creditMemoId).toMatch(/^CRM-/);
  });
});
