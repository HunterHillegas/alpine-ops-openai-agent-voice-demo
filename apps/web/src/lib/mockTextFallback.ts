export function scenarioForTextFallback(message: string, currentScenarioId: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("chg-0000") || normalized.includes("charger chg 0000")) return "tool-failure-retry-once";
  if (normalized.includes("no, wait") || normalized.includes("no wait") || normalized.includes("c h g eight")) return "unclear-asset-id";
  if (normalized.includes("cancel") || normalized.includes("refund")) return "refund-cancellation";
  if (normalized.includes("out of stock") || normalized.includes("no stock")) return "part-out-of-stock";
  if (normalized.includes("warranty") && (normalized.includes("maya") || normalized.includes("bat-7712"))) return "warranty-expired";
  if (normalized.includes("maya") || normalized.includes("bat-7712") || normalized.includes("battery")) return "part-out-of-stock";
  if (normalized.includes("amelia") || normalized.includes("chg-8821") || normalized.includes("charger")) return "dead-charger-outage";
  return currentScenarioId;
}
