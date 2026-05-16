import { describe, expect, it } from "vitest";
import type { EventLogEntry } from "@alpine/mock-data";
import { groupEventsByAgent } from "./ActivityRail";

describe("activity rail grouping", () => {
  it("groups events by agent while preserving first-seen agent order", () => {
    const groups = groupEventsByAgent([
      event("Diagnostics Agent", "Telemetry lookup"),
      event("Dispatch Agent", "Inventory check"),
      event("Diagnostics Agent", "Repair plan estimated")
    ]);

    expect(groups.map((group) => group.agentName)).toEqual(["Diagnostics Agent", "Dispatch Agent"]);
    expect(groups[0]?.events.map((item) => item.label)).toEqual(["Telemetry lookup", "Repair plan estimated"]);
    expect(groups[1]?.events.map((item) => item.label)).toEqual(["Inventory check"]);
  });
});

function event(agentName: string, label: string): EventLogEntry {
  return {
    eventId: `${agentName}-${label}`,
    timestamp: "2026-05-16T12:00:00-07:00",
    agentName,
    type: "tool_call",
    label
  };
}
