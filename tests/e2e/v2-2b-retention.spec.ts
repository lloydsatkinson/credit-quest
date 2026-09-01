import { expect, test, type Page } from "@playwright/test";

async function completeAdultOnboarding(page: Page) {
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.getByTestId("dob").fill("1990-01-01");
  await page.getByTestId("next").click();
  await page.getByLabel("Employment status").selectOption("employed");
  await page.getByLabel("Annual personal income band").selectOption("30_50k");
  await page.getByTestId("next").click();
  await page.getByLabel("Housing situation").selectOption("rent");
  await page.getByTestId("next").click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByTestId("next").click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByTestId("next").click();
  await page.getByLabel("Missed payments").fill("0");
  await page.getByTestId("next").click();
  await page.getByLabel("Hard applications").fill("0");
  await page.getByTestId("next").click();
  await page.getByTestId("finish").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("V2.2B keeps service reminders outside the seven-card Quest Feed", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Continue in demo mode" }).click();
  await completeAdultOnboarding(page);

  await expect(page.getByText("Service reminders only. This does not sign you up for marketing.")).toBeVisible();

  const feed = page.getByTestId("quest-feed");
  await expect(feed.locator("[data-quest-feed-card]")).toHaveCount(7);

  const reminderText = await page.locator('[data-testid="in-app-reminder"]').allTextContents();
  for (const copy of reminderText) {
    expect(copy).not.toMatch(/guaranteed|approved|apply now/i);
  }

  await page.getByLabel("Email me when it’s time to review my Credit Quest plan.").check();
  await expect(page.getByRole("status")).toContainText("Saved on this device for demo mode only.");
});
