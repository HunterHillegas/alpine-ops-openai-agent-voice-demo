import { describe, expect, it } from "vitest";
import type { EventLogEntry } from "@alpine/mock-data";
import { eventArgsForDisplay, groupEventsByAgent } from "./ActivityRail";

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

  it("formats visible event args through trace redaction", () => {
    const formatted = eventArgsForDisplay({
      assetId: "CHG-8821",
      approvalToken: "tok_secret",
      note: "Call +1-805-555-0147 or email amelia.brooks@example.test"
    });

    expect(formatted).toContain('"assetId": "CHG-8821"');
    expect(formatted).toContain('"approvalToken": "[redacted]"');
    expect(formatted).toContain("[redacted-phone]");
    expect(formatted).toContain("[redacted-email]");
    expect(formatted).not.toContain("tok_secret");
    expect(formatted).not.toContain("+1-805-555-0147");
    expect(formatted).not.toContain("amelia.brooks@example.test");
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
