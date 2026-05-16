import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("http://127.0.0.1:8788/reset", {
    data: { scenarioId: "dead-charger-outage" }
  });
  await page.goto("/");
});

test("renders seeded operations cockpit", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Alpine FieldOps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active case workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amelia Brooks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CHG-8821" })).toBeVisible();
  await expect(page.getByText("Control board, AlpineCharge Pro 48A R3")).toBeVisible();
  await expect(page.getByText("Policy notes")).toBeVisible();
  await expect(page.getByText("Technician schedule")).toBeVisible();
  await expect(page.getByText("No pending side effects")).toBeVisible();
});

test("replays main scenario and executes approved work order", async ({ page }) => {
  await page.getByRole("button", { name: "Run replay" }).click();

  await expect(page.getByRole("heading", { name: "Approval requested" })).toBeVisible();
  await expect(page.getByText("1 pending")).toBeVisible();
  await expect(page.getByText("createWorkOrder", { exact: true })).toBeVisible();
  await expect(page.getByText('"assetId"').first()).toBeVisible();
  await expect(page.getByText('"CHG-8821"').first()).toBeVisible();

  await page.getByRole("button", { name: "Approve and run" }).click();

  await expect(page.getByRole("heading", { name: "Work order created" })).toBeVisible();
  await expect(page.getByText("No pending side effects")).toBeVisible();
  await expect(page.getByText(/WO-\d{4}/).first()).toBeVisible();
});

test("mock voice connection and text fallback stay safe without an API key", async ({ page }) => {
  await page.getByRole("button", { name: "Connect voice" }).click();

  await expect(page.getByText("mock").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  await expect(page.getByText("Mock voice mode active. Set OPENAI_API_KEY on the API server for live WebRTC.")).toBeVisible();

  await page.getByPlaceholder("Text fallback for no-mic testing").fill("Check CHG-8821");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Text fallback captured. Run a replay or connect live voice to execute agent tools.")).toBeVisible();
});

test("unclear asset scenario blocks partial ID lookup", async ({ page }) => {
  await page.getByLabel("Load scenario").selectOption("unclear-asset-id");
  await page.getByRole("button", { name: "Run replay" }).click();

  await expect(page.getByRole("heading", { name: "Lookup blocked until exact asset ID is confirmed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Heard partial asset ID: CHG-8..." })).toBeVisible();
  await expect(page.getByText("No pending side effects")).toBeVisible();
});

test("scenario selection focuses the active workspace", async ({ page }) => {
  await page.getByLabel("Load scenario").selectOption("part-out-of-stock");

  await expect(page.getByRole("heading", { name: "Maya Chen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BAT-7712" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expired" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "0 local" })).toBeVisible();
  await expect(page.getByText("INV-HOME20-R2")).toBeVisible();
});
