import { describe, expect, it } from "vitest";
import { normalizeSpokenAssetId, toolDefinitions } from "@alpine/agents";
import { createCompanyApi } from "@alpine/company-api";
import { evalFixtures } from "./index";
import { runEvalFixtures } from "./runner";

describe("eval fixtures", () => {
  it("cover the required demo categories", () => {
    expect(evalFixtures.map((fixture) => fixture.id)).toEqual([
      "dead-charger-success",
      "ambiguous-customer",
      "unclear-asset-id",
      "refund-requires-approval",
      "warranty-expired",
      "part-out-of-stock",
      "tool-failure-retry-once"
    ]);
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

  it("scripted eval runner reports every fixture passing", () => {
    const results = runEvalFixtures();

    expect(results).toHaveLength(evalFixtures.length);
    expect(results.every((result) => result.passed)).toBe(true);
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
});
