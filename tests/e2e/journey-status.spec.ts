import { expect, test, type Page } from "@playwright/test";

async function completeOnboarding(page: Page) {
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
  await page.getByLabel("Hard applications").fill("3");
  await page.getByTestId("next").click();
  await page.getByTestId("finish").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("Journey status does not turn the Quest Feed into an eighth card", async ({ page }) => {
  await completeOnboarding(page);
  const feed = page.getByTestId("quest-feed");
  await expect(feed.locator("[data-quest-feed-card]")).toHaveCount(7);
  await expect(page.getByTestId("journey-status")).toBeVisible();
});
