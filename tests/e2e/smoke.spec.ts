import { expect, test, type Page } from "@playwright/test";

async function completeOnboarding(
  page: Page,
  dateOfBirth: string,
  electoralRoll = true,
  missedPayments = 0,
  hardApplications = 0,
) {
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

  await page.getByLabel("Missed payments").fill(String(missedPayments));
  await page.getByTestId("next").click();

  await page.getByLabel("Hard applications").fill(String(hardApplications));
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

test("Academy is public, readable, canonical and returns a real 404", async ({ page }) => {
  await page.goto("/learn", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Credit Quest Academy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "What is a credit file?" })).toBeVisible();

  await page.goto("/learn/what-is-a-credit-file", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/learn\/what-is-a-credit-file$/);
  await expect(page.getByRole("heading", { name: "What is a credit file?" })).toBeVisible();
  await expect(page.getByText(/educational/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "I understand this" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Still confused?" })).toBeVisible();

  const response = await page.goto("/learn/not-a-real-academy-article", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(404);
});

test("adult can complete onboarding, receive a mission, and see demo-only product education", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByText("Build better credit habits, one move at a time.")).toBeVisible();
  await page.getByRole("link", { name: "Continue in demo mode" }).click();
  await completeOnboarding(page, "1990-01-01", true);

  const feed = page.getByTestId("quest-feed");
  const cards = feed.locator("[data-quest-feed-card]");
  await expect(feed).toBeVisible();
  await expect(cards).toHaveCount(7);
  await expect(cards.nth(0)).toContainText("Your next move");
  await expect(cards.nth(1)).toContainText("Why this matters");
  await expect(cards.nth(2)).toContainText("Your Credit Passport");
  await expect(cards.nth(3)).toContainText("Can I apply yet?");
  await expect(cards.nth(4)).toContainText("Learn in 20 seconds");
  await expect(cards.nth(5)).toContainText("Your progress");
  await expect(cards.nth(6)).toContainText("Know what the score means");

  await expect(page.getByText(/Quest Score/).first()).toBeVisible();
  await expect(page.getByText("Demo only — no application is sent.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Check eligibility with provider" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review readiness guidance" })).toBeVisible();
  await page.getByRole("button", { name: "Start this mission" }).click();
  await expect(page.getByRole("status")).toContainText("Mission started");
  await expect(page.getByText(/ready to continue through its action journey/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(0);
  await expect(page.getByTestId("missions-done")).toHaveText("0");
});

test("electoral-roll mission selects electoral-roll Academy education", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", false);

  const academyCard = page.getByTestId("quest-feed").locator("[data-quest-feed-card]").nth(4);
  await expect(page.getByRole("heading", { name: "Get on the electoral roll" })).toBeVisible();
  await expect(academyCard).toContainText("Learn in 20 seconds");
  await expect(academyCard).toContainText("Why the electoral roll can matter");

  await academyCard.getByRole("link", { name: "Learn more" }).click();
  await expect(page).toHaveURL(/\/learn\/electoral-roll-basics$/);
  await expect(page.getByRole("heading", { name: "Why the electoral roll can matter" })).toBeVisible();
});

test("Passport and readiness detail routes use current demo guidance", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", true);

  await page.goto("/passport", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Your Credit Passport" })).toBeVisible();
  await expect(page.getByTestId("passport-pillar-identity")).toBeVisible();

  await page.goto("/readiness", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /Can I apply yet/i })).toBeVisible();
  await expect(page.getByText(/does not mean you will be approved/i)).toBeVisible();
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

test("17-year-old gets education mode with protective Academy and no credit-product referral", async ({ page }) => {
  await completeOnboarding(page, "2009-08-25", true);
  await expect(page.getByText("Your next move")).toBeVisible();
  const academyCard = page.getByTestId("quest-feed").locator("[data-quest-feed-card]").nth(4);
  await expect(academyCard).toContainText("Credit basics before 18");
  await expect(academyCard.getByText(/apply for|check eligibility|credit card/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Check eligibility with provider" })).toHaveCount(0);

  await page.goto("/readiness", { waitUntil: "networkidle" });
  await expect(page.getByText("Products can wait", { exact: true })).toBeVisible();
  await expect(page.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(page.getByText("Green", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /check eligibility/i })).toHaveCount(0);

  await page.goto("/offers", { waitUntil: "networkidle" });
  await expect(page.getByText("Learn now. Products can wait.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check eligibility with provider" })).toHaveCount(0);
});

test("Safe Mode keeps readiness red, selects protective Academy, and suppresses product routes", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", true, 2, 3);

  await expect(page.getByText("Safe Mode", { exact: true })).toBeVisible();
  await expect(page.getByText("Do not apply yet", { exact: true }).first()).toBeVisible();
  const academyCard = page.getByTestId("quest-feed").locator("[data-quest-feed-card]").nth(4);
  await expect(academyCard).toContainText("Protect payments first");
  await expect(academyCard.getByText(/check eligibility|apply now|new credit/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Check eligibility with provider" })).toHaveCount(0);

  await page.goto("/readiness", { waitUntil: "networkidle" });
  await expect(page.getByText("Red", { exact: true })).toBeVisible();
  await expect(page.getByText("Do not apply yet", { exact: true })).toBeVisible();
  await expect(page.getByText("Green", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /check eligibility/i })).toHaveCount(0);
});

test("amber readiness does not invent a reassessment countdown", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", true, 0, 2);

  await page.goto("/readiness", { waitUntil: "networkidle" });
  await expect(page.getByText("Amber", { exact: true })).toBeVisible();
  await expect(page.getByText("Getting closer", { exact: true })).toBeVisible();
  await expect(page.getByText(/no exact reassessment date/i)).toBeVisible();
  await expect(page.getByText(/\b\d+\s+days?\b/i)).toHaveCount(0);
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

test("sandbox completion is explicitly non-lender and non-application", async ({ page }) => {
  await page.goto("/sandbox/referral-complete", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Sandbox journey complete" })).toBeVisible();
  await expect(page.getByText(/No lender or credit application was contacted/i)).toBeVisible();
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
