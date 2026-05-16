import { describe, expect, it } from "vitest";
import { normalizeSpokenAssetId, toolDefinitions } from "@alpine/agents";
import { createCompanyApi } from "@alpine/company-api";
import { evalFixtures } from "./index";

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
    expect(writeTools.map((tool) => tool.name)).toEqual(["createWorkOrder", "reservePart", "cancelAppointment", "createCreditMemo"]);
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
});
