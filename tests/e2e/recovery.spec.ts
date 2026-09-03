import { expect, test } from "@playwright/test";

const opaqueToken = "A".repeat(43);

test("direct decline recovery remains a customer-controlled entry point", async ({ page }) => {
  await page.goto("/recovery", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "I’ve just been declined" })).toBeVisible();
  await expect(page.getByText(/help you understand what to work on next/i)).toBeVisible();
  await expect(page.getByText(/we know why/i)).toHaveCount(0);
});

test("an unusable partner handoff token fails generically without decoding context into the URL", async ({ page }) => {
  await page.goto(`/recovery/handoff/${opaqueToken}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: /this handoff link can.?t be used/i })).toBeVisible();
  await expect(page.getByText(/nothing from this link has been added to your credit quest plan/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(opaqueToken);
  await expect(page.getByText(/partner_reason|application-abc|campaign-42/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /start recovery directly/i })).toBeVisible();
});
