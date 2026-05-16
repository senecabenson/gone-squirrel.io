import { test, expect } from "@playwright/test";

/**
 * Phase A — block-aware auto-scheduling. Verifies the "Task Blocks Calendar"
 * settings surface renders and persists. Mirrors the auth/env conventions of
 * the other tests/e2e specs (seeded test@example.com on port 3001).
 *
 * Generous timeouts: the /settings route compiles on first authed hit under
 * `next dev` and can take well over the default 30s.
 */
const BASE = "http://localhost:3001";

test.describe("Scheduling Blocks: Task Blocks settings", () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/auth/signin`);
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "testpassword123");
    await page.click('button[type="submit"]:has-text("Sign in")');
    await page.waitForURL("**/calendar", { timeout: 30000 });

    await page.goto(`${BASE}/settings#auto-schedule`);
    await expect(
      page.getByRole("heading", { name: "Auto-Schedule Settings" })
    ).toBeVisible({ timeout: 90000 });
  });

  test("Task Blocks section renders with feed picker and policy control", async ({
    page,
  }) => {
    await expect(
      page.getByText("Task Blocks Calendar", { exact: true })
    ).toBeVisible();

    // Feed picker default (no calendar selected)
    await expect(
      page.getByText("Off — flat working hours").first()
    ).toBeVisible();

    // No-block policy control + its options
    const policyTrigger = page
      .getByText("When a day has no matching work block", { exact: true })
      .locator("..")
      .locator("button");
    await expect(policyTrigger).toBeVisible();
    await policyTrigger.click();
    await expect(
      page.getByRole("option", { name: "Schedule nothing (protect the day)" })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Fall back to flat working hours" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("selecting the no-block policy persists across reload", async ({
    page,
  }) => {
    const policyTrigger = page
      .getByText("When a day has no matching work block", { exact: true })
      .locator("..")
      .locator("button");
    await policyTrigger.click();
    await page
      .getByRole("option", { name: "Fall back to flat working hours" })
      .click();

    // Allow the settings store PATCH to persist, then hard reload.
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Auto-Schedule Settings" })
    ).toBeVisible({ timeout: 90000 });

    await expect(
      page.getByText("Fall back to flat working hours")
    ).toBeVisible();
  });
});
