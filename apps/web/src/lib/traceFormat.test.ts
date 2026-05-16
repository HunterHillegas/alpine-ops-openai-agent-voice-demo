import { describe, expect, it } from "vitest";
import { formatEventArgs, redactTraceValue } from "./traceFormat";

describe("trace formatting", () => {
  it("redacts sensitive keys recursively while preserving operational arguments", () => {
    expect(redactTraceValue({
      assetId: "CHG-8821",
      payload: {
        customerId: "cus_amelia_brooks",
        approvalToken: "tok_supersecret",
        phone: "+1-805-555-0147",
        nested: [{ email: "amelia.brooks@example.test" }]
      }
    })).toEqual({
      assetId: "CHG-8821",
      payload: {
        customerId: "cus_amelia_brooks",
        approvalToken: "[redacted]",
        phone: "[redacted]",
        nested: [{ email: "[redacted]" }]
      }
    });
  });

  it("redacts sensitive string values even when they appear in non-sensitive fields", () => {
    const formatted = formatEventArgs({
      query: "Call +1-805-555-0147 or email amelia.brooks@example.test",
      note: "Use tok_abc123 for approval"
    });

    expect(formatted).toContain("[redacted-phone]");
    expect(formatted).toContain("[redacted-email]");
    expect(formatted).toContain("[redacted-token]");
    expect(formatted).not.toContain("+1-805-555-0147");
    expect(formatted).not.toContain("amelia.brooks@example.test");
    expect(formatted).not.toContain("tok_abc123");
  });
});
