import { expect, test } from "@playwright/test";

test("transcribes generated speech through the live browser microphone path", async ({ page }) => {
  await page.request.post("http://127.0.0.1:8788/reset", {
    data: { scenarioId: "dead-charger-outage" }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open mic" }).click();
  await page.getByRole("button", { name: "Connect voice" }).click();

  await expect(page.getByText("live").first()).toBeVisible();
  await expect(page.getByText("WebRTC")).toBeVisible();
  await expect(page.getByText("Live voice session connected.")).toBeVisible();

  await expect(page.locator(".transcript").getByText("Customer Amelia Brooks says charger CHG-8821 died after a power outage", { exact: false })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".error-banner")).toHaveCount(0);
});
