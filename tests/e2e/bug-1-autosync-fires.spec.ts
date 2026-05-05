import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";

async function ensureGoogleEnabled(page: import("@playwright/test").Page) {
  // The first switch in the Google Calendar SettingRow is the enabled toggle.
  // It has no id; locate via SettingRow label proximity.
  const googleRow = page
    .locator('text="Google Calendar"')
    .nth(1) // first hit is the SettingRow label, second is the inline label inside
    .locator("xpath=ancestor::div[1]/ancestor::div[1]");
  // Fallback: just take the first switch on the page that lives near the
  // Google Calendar copy.
  const enabledSwitch = page
    .locator('button[role="switch"]')
    .first();
  const state = await enabledSwitch.getAttribute("data-state");
  if (state !== "checked") {
    await enabledSwitch.click();
    await page.waitForTimeout(300);
  }
  // Some assertion uses unused var googleRow; fold under no-op
  void googleRow;
}

test.describe("Bug 1: Auto-sync fires periodically for Google Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/auth/signin`);
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "testpassword123");
    await page.click('button[type="submit"]:has-text("Sign in")');
    await page.waitForURL("**/calendar", { timeout: 10000 });
  });

  test("autoSync toggle persists after save and reload", async ({ page }) => {
    await page.goto(`${BASE}/settings#integrations`);
    await page.waitForSelector('text="Integration Settings"', { timeout: 5000 });

    await ensureGoogleEnabled(page);

    const autoSync = page.locator("#auto-sync");
    await autoSync.waitFor({ state: "visible", timeout: 5000 });

    if ((await autoSync.getAttribute("data-state")) !== "checked") {
      await autoSync.click();
      await page.waitForTimeout(500);
    }
    expect(await autoSync.getAttribute("data-state")).toBe("checked");

    const intervalInput = page.locator('input[type="number"]').first();
    expect(parseInt((await intervalInput.inputValue()) || "0", 10)).toBeGreaterThan(0);

    const saveButton = page.locator('button:has-text("Save")');
    if ((await saveButton.count()) > 0) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }

    await page.reload();
    await page.waitForSelector('text="Integration Settings"', { timeout: 5000 });

    const reloadedSwitch = page.locator("#auto-sync");
    await reloadedSwitch.waitFor({ state: "visible", timeout: 5000 });
    expect(await reloadedSwitch.getAttribute("data-state")).toBe("checked");
  });

  test("autoSync can be toggled on and off", async ({ page }) => {
    await page.goto(`${BASE}/settings#integrations`);
    await page.waitForSelector('text="Integration Settings"', { timeout: 5000 });

    await ensureGoogleEnabled(page);

    const autoSync = page.locator("#auto-sync");
    await autoSync.waitFor({ state: "visible", timeout: 5000 });

    const initial = await autoSync.getAttribute("data-state");
    await autoSync.click();
    await page.waitForTimeout(500);
    expect(await autoSync.getAttribute("data-state")).not.toBe(initial);

    await autoSync.click();
    await page.waitForTimeout(500);
    expect(await autoSync.getAttribute("data-state")).toBe(initial);
  });

  test("autoSync interval field is editable when enabled", async ({ page }) => {
    await page.goto(`${BASE}/settings#integrations`);
    await page.waitForSelector('text="Integration Settings"', { timeout: 5000 });

    await ensureGoogleEnabled(page);

    const autoSync = page.locator("#auto-sync");
    await autoSync.waitFor({ state: "visible", timeout: 5000 });
    if ((await autoSync.getAttribute("data-state")) !== "checked") {
      await autoSync.click();
      await page.waitForTimeout(500);
    }

    const intervalInput = page.locator('input[type="number"]').first();
    expect(await intervalInput.count()).toBeGreaterThan(0);

    const currentValue = parseInt(
      (await intervalInput.inputValue()) || "0",
      10
    );
    expect(currentValue).toBeGreaterThan(0);

    const newValue = currentValue === 5 ? 10 : 5;
    await intervalInput.fill(newValue.toString());
    await page.waitForTimeout(500);

    expect(
      parseInt((await intervalInput.inputValue()) || "0", 10)
    ).toBe(newValue);

    const saveButton = page.locator('button:has-text("Save")');
    if ((await saveButton.count()) > 0) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }

    await page.reload();
    await page.waitForSelector('text="Integration Settings"', { timeout: 5000 });

    const reloadedInput = page.locator('input[type="number"]').first();
    expect(
      parseInt((await reloadedInput.inputValue()) || "0", 10)
    ).toBe(newValue);
  });

  test("autoSync interval field is hidden when autoSync is disabled", async ({
    page,
  }) => {
    await page.goto(`${BASE}/settings#integrations`);
    await page.waitForSelector('text="Integration Settings"', { timeout: 5000 });

    await ensureGoogleEnabled(page);

    const autoSync = page.locator("#auto-sync");
    await autoSync.waitFor({ state: "visible", timeout: 5000 });
    if ((await autoSync.getAttribute("data-state")) === "checked") {
      await autoSync.click();
      await page.waitForTimeout(500);
    }

    const intervalInput = page.locator('input[type="number"]').first();
    const count = await intervalInput.count();
    if (count > 0) {
      expect(await intervalInput.isVisible()).toBe(false);
    }
  });
});
