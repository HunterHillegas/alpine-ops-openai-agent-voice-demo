import { describe, expect, it } from "vitest";
import { buildAlpineRealtimeAgent, extractClientSecret } from "./realtimeConsole";

describe("realtime console integration", () => {
  it("builds the triage agent with specialist handoffs and core tools", () => {
    const agent = buildAlpineRealtimeAgent();

    expect(agent.name).toBe("Realtime Triage Agent");
    expect(agent.handoffs.map((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name))).toEqual([
      "Customer Context Agent",
      "Diagnostics Agent",
      "Dispatch Agent",
      "Policy and Billing Agent",
      "Message Composer Agent"
    ]);
    expect(agent.tools.map((tool) => tool.name)).toEqual(["waitForMoreAudio", "getAsset", "requestHumanApproval"]);
  });

  it("exposes write tools only on bounded specialists with approval-token parameters", () => {
    const agent = buildAlpineRealtimeAgent();
    const customer = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Customer Context Agent");
    const dispatch = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Dispatch Agent");
    const policy = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Policy and Billing Agent");

    expect(toolNames(customer)).toEqual(["searchCustomers", "getCustomer", "getCustomerAssets", "getOpenTickets", "getServiceHistory", "createTicket", "updateTicket"]);
    const diagnostics = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Diagnostics Agent");
    expect(toolNames(diagnostics)).toEqual(["getAssetTelemetry", "getKnownIssuePatterns", "checkFirmwareStatus", "estimateRepairPlan"]);
    expect(toolNames(dispatch)).toContain("createWorkOrder");
    expect(toolNames(dispatch)).toContain("reservePart");
    expect(toolNames(policy)).toContain("getPolicy");
    expect(toolNames(policy)).toContain("cancelAppointment");
    expect(toolNames(policy)).toContain("createCreditMemo");
    const composer = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Message Composer Agent");
    expect(toolNames(composer)).toContain("saveInternalNote");
    expect(toolNames(composer)).toContain("createCaseSummary");
    expect(toolNames(composer)).toContain("saveCustomerMessage");
    expect(toolNames(composer)).toContain("sendCustomerMessage");
  });

  it("extracts ephemeral client secrets without exposing server keys", () => {
    expect(extractClientSecret({ mode: "mock", data: { client_secret: "nope" } })).toBeNull();
    expect(extractClientSecret({ mode: "live", data: { client_secret: { value: "eph_123" } } })).toBe("eph_123");
    expect(extractClientSecret({ mode: "live", data: { value: "eph_456" } })).toBe("eph_456");
  });
});

function toolNames(agent: unknown) {
  return ((agent as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []).map((tool) => tool.name);
}
