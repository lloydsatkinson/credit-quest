import { expect, test } from "@playwright/test";

const opaqueToken = "A".repeat(43);

test("direct decline recovery remains a customer-controlled entry point", async ({ page }) => {
  await page.goto("/recovery", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "I’ve just been declined" })).toBeVisible();
  await expect(page.getByText(/help you understand what to work on next/i)).toBeVisible();
  await expect(page.getByText(/we know why/i)).toHaveCount(0);
});

test("direct recovery exposes no trusted partner, destination or medical controls and stays unpersisted in demo", async ({ page }) => {
  await page.goto("/recovery", { waitUntil: "networkidle" });

  for (const forbidden of [
    /partner id/i,
    /return url/i,
    /^environment$/i,
    /medical condition/i,
    /^diagnosis$/i,
    /safe mode/i,
  ]) {
    await expect(page.getByText(forbidden)).toHaveCount(0);
  }

  await page.getByLabel("When were you declined?").fill("2026-09-01");
  await page.getByRole("button", { name: "Build my recovery plan" }).click();
  await expect(page.getByText("Demo recovery plan started. Nothing was saved.")).toBeVisible();
});

test("an unusable partner handoff token fails generically without decoding context into the URL", async ({ page }) => {
  await page.goto(`/recovery/handoff/${opaqueToken}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: /this handoff link can.?t be used/i })).toBeVisible();
  await expect(page.getByText(/nothing from this link has been added to your credit quest plan/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(opaqueToken);
  await expect(page.getByText(/partner_reason|application-abc|campaign-42/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /start recovery directly/i })).toBeVisible();
});
