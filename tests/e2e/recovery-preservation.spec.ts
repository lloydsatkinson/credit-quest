import { expect, test, type Page } from "@playwright/test";

async function completeNormalOnboarding(page: Page) {
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

test("normal customers keep the original seven-card Credit Quest experience", async ({ page }) => {
  await completeNormalOnboarding(page);

  const feed = page.getByTestId("quest-feed");
  const cards = feed.locator("[data-quest-feed-card]");
  await expect(cards).toHaveCount(7);
  await expect(cards.nth(0)).toContainText("Your next move");
  await expect(cards.nth(2)).toContainText("Your Credit Passport");
  await expect(cards.nth(3)).toContainText("Can I apply yet?");
  await expect(cards.nth(5)).toContainText("Your progress");
  await expect(cards.nth(6)).toContainText("Know what the score means");

  await expect(page.getByRole("region", { name: "Your recovery plan" })).toHaveCount(0);
  await expect(page.getByLabel("Return to original partner")).toHaveCount(0);
  await expect(page.getByText(/Recovery progress/i)).toHaveCount(0);
});
