import { describe, expect, it } from "vitest";
import { scenarioForTextFallback } from "./mockTextFallback";

describe("mock text fallback routing", () => {
  it("maps typed no-mic demo requests to seeded replay scenarios", () => {
    expect(scenarioForTextFallback("Check CHG-8821 after the outage", "unclear-asset-id")).toBe("dead-charger-outage");
    expect(scenarioForTextFallback("Cancel tomorrow and refund the deposit", "dead-charger-outage")).toBe("refund-cancellation");
    expect(scenarioForTextFallback("Look up charger C H G eight... no wait", "dead-charger-outage")).toBe("unclear-asset-id");
    expect(scenarioForTextFallback("Check CHG-0000 and retry once", "dead-charger-outage")).toBe("tool-failure-retry-once");
    expect(scenarioForTextFallback("Maya BAT-7712 warranty check", "dead-charger-outage")).toBe("warranty-expired");
    expect(scenarioForTextFallback("Maya battery has no stock locally", "dead-charger-outage")).toBe("part-out-of-stock");
    expect(scenarioForTextFallback("Use the scenario already loaded", "part-out-of-stock")).toBe("part-out-of-stock");
  });
});
