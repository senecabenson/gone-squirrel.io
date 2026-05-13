import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function signIn(page: import("@playwright/test").Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    test.skip(true, "Set E2E_EMAIL and E2E_PASSWORD env vars to run.");
  }
  await page.goto(`${BASE}/auth/signin`);
  if (page.url().includes("/auth/signin")) {
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.locator('button[type="submit"]:has-text("Sign in")').click();
    await page.waitForURL(/\/(calendar|tasks)/, { timeout: 10000 });
  }
}

async function openNewTaskModal(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/tasks`);
  await page.click('button:has-text("New task")');
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
}

function pill(page: import("@playwright/test").Page, n: number) {
  return page.locator(
    `[role="dialog"] button[aria-pressed][class*="rounded-full"]:has-text("${n}")`,
  );
}

test.describe("Chunk size picker", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("defaults to 30 on new task", async ({ page }) => {
    await openNewTaskModal(page);
    await expect(pill(page, 30)).toHaveAttribute("aria-pressed", "true");
    for (const n of [15, 45, 60]) {
      await expect(pill(page, n)).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("clicking a pill toggles selection", async ({ page }) => {
    await openNewTaskModal(page);
    await pill(page, 45).click();
    await expect(pill(page, 45)).toHaveAttribute("aria-pressed", "true");
    await expect(pill(page, 30)).toHaveAttribute("aria-pressed", "false");

    await pill(page, 60).click();
    await expect(pill(page, 60)).toHaveAttribute("aria-pressed", "true");
    await expect(pill(page, 45)).toHaveAttribute("aria-pressed", "false");
  });

  test("create persists chunkMin/chunkMax = picked value", async ({ page }) => {
    const title = `[E2E TEST] chunk picker ${Date.now()}`;

    await openNewTaskModal(page);
    await page.fill("#title", title);
    await page.fill('[role="dialog"] input[type="number"]', "90");
    await pill(page, 45).click();
    await page.click('[role="dialog"] button:has-text("Create")');
    await page.waitForSelector(`text="${title}"`, { timeout: 5000 });

    // Reopen to verify it loads back with 45 selected
    const row = page.locator("li", { hasText: title }).first();
    await row.locator('button[aria-label="Edit task"]').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await expect(pill(page, 45)).toHaveAttribute("aria-pressed", "true");

    // Cleanup
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await row.locator('button[aria-label="Delete task"]').click();
    // Confirm delete dialog if any
    const confirmBtn = page.locator('button:has-text("Delete"):visible').last();
    if (await confirmBtn.count()) await confirmBtn.click();
  });

  test("edit changes pill and persists", async ({ page }) => {
    const title = `[E2E TEST] chunk edit ${Date.now()}`;

    await openNewTaskModal(page);
    await page.fill("#title", title);
    await page.fill('[role="dialog"] input[type="number"]', "60");
    await pill(page, 30).click();
    await page.click('[role="dialog"] button:has-text("Create")');
    await page.waitForSelector(`text="${title}"`, { timeout: 5000 });

    const row = page.locator("li", { hasText: title }).first();
    await row.locator('button[aria-label="Edit task"]').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    await pill(page, 60).click();
    await page.click('[role="dialog"] button:has-text("Update")');
    await page.waitForSelector('[role="dialog"]', {
      state: "hidden",
      timeout: 5000,
    });

    await row.locator('button[aria-label="Edit task"]').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await expect(pill(page, 60)).toHaveAttribute("aria-pressed", "true");
    await page.click('[role="dialog"] button:has-text("Cancel")');

    await row.locator('button[aria-label="Delete task"]').click();
    const confirmBtn = page.locator('button:has-text("Delete"):visible').last();
    if (await confirmBtn.count()) await confirmBtn.click();
  });
});
