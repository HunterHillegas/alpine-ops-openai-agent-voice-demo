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

  it("extracts ephemeral client secrets without exposing server keys", () => {
    expect(extractClientSecret({ mode: "mock", data: { client_secret: "nope" } })).toBeNull();
    expect(extractClientSecret({ mode: "live", data: { client_secret: { value: "eph_123" } } })).toBe("eph_123");
    expect(extractClientSecret({ mode: "live", data: { value: "eph_456" } })).toBe("eph_456");
  });
});
