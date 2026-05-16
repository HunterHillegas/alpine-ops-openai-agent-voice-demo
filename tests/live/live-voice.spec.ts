import { expect, test } from "@playwright/test";

test("connects the browser console to a live realtime session", async ({ page }) => {
  await page.request.post("http://127.0.0.1:8788/reset", {
    data: { scenarioId: "dead-charger-outage" }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Connect voice" }).click();

  await expect(page.getByText("live").first()).toBeVisible();
  await expect(page.getByText("WebRTC")).toBeVisible();
  await expect(page.getByText("Live voice session connected.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("disconnected").first()).toBeVisible();
});
