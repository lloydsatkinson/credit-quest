import { expect, test, type Page } from "@playwright/test";

async function completeOnboarding(page: Page, dateOfBirth: string, electoralRoll = true) {
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.getByTestId("dob").fill(dateOfBirth);
  await expect(page.getByTestId("next")).toBeEnabled();
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

test("onboarding uses the new guided Quest visual shell", async ({ page }) => {
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await expect(page.getByTestId("onboarding-shell")).toBeVisible();
  await expect(page.getByText("8 quick questions", { exact: true })).toBeVisible();
  await expect(page.getByText("We only ask what changes your plan.", { exact: true })).toBeVisible();
});

test("adult can complete onboarding, receive a mission, and see a relevant referral", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByText("Build better credit habits, one move at a time.")).toBeVisible();
  await page.getByRole("link", { name: "Continue in demo mode" }).click();
  await completeOnboarding(page, "1990-01-01", true);

  const feed = page.getByTestId("quest-feed");
  await expect(feed).toBeVisible();
  await expect(feed.locator("[data-quest-feed-card]")).toHaveCount(4);
  await expect(feed.getByText("Your next move", { exact: true })).toBeVisible();
  await expect(feed.getByText("Why this matters", { exact: true })).toBeVisible();
  await expect(feed.getByText("Your progress", { exact: true })).toBeVisible();
  await expect(feed.getByText("Know what the score means", { exact: true })).toBeVisible();

  await expect(page.getByText(/Quest Score/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Check eligibility with provider" })).toBeVisible();
  await page.getByRole("button", { name: "Start this mission" }).click();
  await expect(page.getByRole("status")).toContainText("Mission started");
  await expect(page.getByText(/ready to continue through its action journey/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(0);
  await expect(page.getByTestId("missions-done")).toHaveText("0");
});

test("starting electoral-roll guidance never counts as completion", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", false);

  await expect(page.getByRole("heading", { name: "Get on the electoral roll" })).toBeVisible();
  await expect(page.getByTestId("missions-done")).toHaveText("0");

  await page.getByRole("button", { name: "Start this mission" }).click();
  await expect(page.getByText(/ready to continue through its action journey/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(0);
  await expect(page.getByTestId("missions-done")).toHaveText("0");
});

test("17-year-old gets education mode with no credit-product referral", async ({ page }) => {
  await completeOnboarding(page, "2009-08-25", true);
  await expect(page.getByText("Your next move")).toBeVisible();
  await expect(page.getByRole("link", { name: "Check eligibility with provider" })).toHaveCount(0);

  await page.goto("/offers", { waitUntil: "networkidle" });
  await expect(page.getByText("Learn now. Products can wait.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check eligibility with provider" })).toHaveCount(0);
});

test("accounts and actions routes keep safe demo-mode boundaries", async ({ page }) => {
  await page.goto("/accounts", { waitUntil: "networkidle" });
  await expect(page.getByTestId("accounts-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "My accounts" })).toBeVisible();
  await expect(page.getByText("Only the details that help your plan.", { exact: true })).toBeVisible();
  await expect(page.getByText(/never enter passwords or a full card number/i)).toBeVisible();

  await page.goto("/actions/demo-mission", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("PWA manifest exposes install assets", async ({ page, request }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.display).toBe("standalone");
  expect(body.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
  ]));
});
