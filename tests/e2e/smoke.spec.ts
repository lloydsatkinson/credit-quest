import { expect, test, type Page } from "@playwright/test";

async function completeOnboarding(page: Page, dateOfBirth: string, electoralRoll = true) {
  await page.goto("/onboarding");
  await page.getByTestId("dob").fill(dateOfBirth);
  await page.getByTestId("next").click();

  await page.getByLabel("Employment status").selectOption("employed");
  await page.getByLabel("Annual personal income band").selectOption("30_50k");
  await page.getByTestId("next").click();

  await page.getByLabel("Housing situation").selectOption("rent");
  await page.getByTestId("next").click();

  await page.getByRole("button", { name: electoralRoll ? "Yes" : "No", exact: true }).click();
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

test("adult can complete onboarding, receive a mission, and see a relevant referral", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Build better credit habits, one move at a time.")).toBeVisible();
  await page.getByRole("link", { name: "Continue in demo mode" }).click();
  await completeOnboarding(page, "1990-01-01", true);

  await expect(page.getByText("Your next best move")).toBeVisible();
  await expect(page.getByText(/Quest Score/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Check eligibility with provider" })).toBeVisible();
  await page.getByRole("button", { name: "Start this mission" }).click();
  await expect(page.getByRole("status")).toContainText("Mission started");
  await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
  await expect(page.getByTestId("missions-done")).toHaveText("0");
});

test("starting is not completion and completing a real mission recalculates the plan", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", false);

  await expect(page.getByRole("heading", { name: "Get on the electoral roll" })).toBeVisible();
  await expect(page.getByTestId("missions-done")).toHaveText("0");

  await page.getByRole("button", { name: "Start this mission" }).click();
  await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
  await expect(page.getByTestId("missions-done")).toHaveText("0");

  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByTestId("missions-done")).toHaveText("1");
  await expect(page.getByRole("heading", { name: "Get on the electoral roll" })).toHaveCount(0);
});

test("17-year-old gets education mode with no credit-product referral", async ({ page }) => {
  await completeOnboarding(page, "2009-08-26", true);
  await expect(page.getByText("Your next best move")).toBeVisible();
  await expect(page.getByRole("link", { name: "Check eligibility with provider" })).toHaveCount(0);

  await page.goto("/offers");
  await expect(page.getByText("Learn now. Products can wait.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check eligibility with provider" })).toHaveCount(0);
});

test("PWA manifest exposes install assets", async ({ page, request }) => {
  await page.goto("/");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.display).toBe("standalone");
  expect(body.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
  ]));
});
