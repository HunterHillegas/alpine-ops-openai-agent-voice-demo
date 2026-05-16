import type { Asset, CompanyState, KnownIssuePattern, TelemetryPoint } from "@alpine/mock-data";

export interface FirmwareStatus {
  assetId: string;
  firmwareVersion: string;
  currentVersion: string;
  updateRecommended: boolean;
  warnings: string[];
}

export interface RepairPlan {
  assetId: string;
  likelyPartId: string;
  confidence: KnownIssuePattern["confidence"];
  severity: "low" | "medium" | "high";
  steps: string[];
  summary: string;
}

export function firmwareStatus(asset: Asset, telemetry: TelemetryPoint[]): FirmwareStatus {
  const warnings = telemetry.flatMap((point) => point.firmwareWarnings);
  const currentVersion = asset.productModel.includes("AlpineCharge") ? "4.8.14" : "2.2.0";
  return {
    assetId: asset.assetId,
    firmwareVersion: asset.firmwareVersion,
    currentVersion,
    updateRecommended: asset.firmwareVersion !== currentVersion || warnings.length > 0,
    warnings: [...new Set(warnings)]
  };
}

export function estimateRepairPlan(state: CompanyState, asset: Asset): RepairPlan {
  const telemetry = state.telemetry.filter((point) => point.assetId === asset.assetId);
  const symptoms = new Set(telemetry.flatMap((point) => [point.faultType, ...point.firmwareWarnings].filter(Boolean) as string[]));
  const pattern = state.knownIssuePatterns.find((item) =>
    item.productModel === asset.productModel && item.symptoms.some((symptom) => symptoms.has(symptom))
  );
  const fallbackPartId = asset.productModel.includes("AlpineVault") ? "INV-HOME20-R2" : "PCB-48A-R3";
  const likelyPartId = pattern?.likelyPartId ?? fallbackPartId;
  const severity = telemetry.some((point) => point.connectivityStatus === "offline" || point.faultType === "ground_fault_reset") ? "high" : "medium";

  return {
    assetId: asset.assetId,
    likelyPartId,
    confidence: pattern?.confidence ?? "medium",
    severity,
    steps: [
      "Confirm exact asset ID and customer identity.",
      "Review telemetry and known issue pattern.",
      `Bring ${likelyPartId} if local inventory allows.`,
      "Do not schedule or reserve parts until approval succeeds."
    ],
    summary: pattern?.summary ?? `Likely ${likelyPartId} replacement based on current telemetry.`
  };
}
