import { test, expect } from "@playwright/test";

test.describe("Bug 2: Scheduler respects work hours and energy preferences", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto("http://localhost:3001/auth/signin");

    // Log in with test credentials
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "testpassword123");
    await page.click('button[type="submit"]:has-text("Sign in")');

    // Wait for redirect to calendar page
    await page.waitForURL("**/calendar", { timeout: 10000 });
  });

  test("scheduler keeps tasks within work hours", async ({ page }) => {
    // Navigate to settings
    await page.goto("http://localhost:3001/settings#auto-schedule");

    // Wait for Auto-Schedule Settings section to load
    await page.waitForSelector('text="Auto-Schedule Settings"', { timeout: 5000 });

    // Set work hours: Start Time to 9:00 AM
    // Using getByLabel to find the label "Start Time" and interact with associated Select
    const startTimeSelect = page.locator("#work-hour-start");
    await startTimeSelect.click();
    await page.getByRole("option", { name: "9:00 AM", exact: true }).click();

    // Set work hours: End Time to 3:00 PM
    const endTimeSelect = page.locator("#work-hour-end");
    await endTimeSelect.click();
    await page.getByRole("option", { name: "3:00 PM", exact: true }).click();

    // Set High Energy Hours: 9 AM to 12 PM
    const highEnergyLabel = page.getByText("High Energy Hours", { exact: true });
    // Get the container for high energy selects
    const highEnergyContainer = highEnergyLabel.locator("..");

    // First select in the high energy container is start time
    const highEnergyStartSelect = highEnergyContainer.locator("button").first();
    await highEnergyStartSelect.click();
    await page.getByRole("option", { name: "9:00 AM", exact: true }).click();

    // Second select in the high energy container is end time
    const highEnergyEndSelect = highEnergyContainer.locator("button").nth(1);
    await highEnergyEndSelect.click();
    await page.getByRole("option", { name: "12:00 PM", exact: true }).click();

    // Set Low Energy Hours: 1 PM to 3 PM
    const lowEnergyLabel = page.getByText("Low Energy Hours", { exact: true });
    const lowEnergyContainer = lowEnergyLabel.locator("..");

    const lowEnergyStartSelect = lowEnergyContainer.locator("button").first();
    await lowEnergyStartSelect.click();
    await page.getByRole("option", { name: "1:00 PM", exact: true }).click();

    const lowEnergyEndSelect = lowEnergyContainer.locator("button").nth(1);
    await lowEnergyEndSelect.click();
    await page.getByRole("option", { name: "3:00 PM", exact: true }).click();

    // Navigate to tasks page
    await page.goto("http://localhost:3001/tasks");

    // Create 5 test tasks with different energy levels
    const taskConfigs = [
      { name: "High energy task 1", energy: "HIGH" },
      { name: "High energy task 2", energy: "HIGH" },
      { name: "Medium energy task", energy: "MEDIUM" },
      { name: "Low energy task", energy: "LOW" },
      { name: "No preference", energy: null },
    ];

    for (const config of taskConfigs) {
      // Click the "Create Task" button
      await page.locator(`button:has-text("New task")`).last().click();

      // Wait for the modal to appear
      await page.waitForSelector('text="New Task"', { timeout: 5000 });

      // Fill in the title field
      await page.fill("#title", config.name);

      // Set due date to 5 days from today
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5);
      const dueDateString = dueDate.toISOString().split("T")[0]; // YYYY-MM-DD format
      await page.fill("#dueDate", dueDateString);

      // Set duration to 60 minutes
      await page.fill("#duration", "60");

      // Set energy level if specified
      if (config.energy) {
        const energySelect = page.getByLabel("Energy Level");
        await energySelect.click();
        // Click the energy level option
        const energyText = config.energy.charAt(0) + config.energy.slice(1).toLowerCase();
        await page.getByRole("option", { name: energyText, exact: true }).click();
      }

      // Click the Create button to submit
      await page.click('button:has-text("Create")');

      // Wait for modal to close before creating next task
      await page.waitForTimeout(500);
    }

    // Trigger auto-schedule
    await page.click('button:has-text("Auto-schedule")');

    // Wait for scheduling to complete
    await page.waitForTimeout(2000);

    // Verify all scheduled tasks are within work hours (9 AM–3 PM)
    const taskRows = await page.locator("tbody tr").all();

    for (const row of taskRows) {
      // Check if the row has a scheduled time (look for time format)
      const timeCell = row.locator("td").nth(8); // Schedule column
      const timeText = await timeCell.textContent();

      // If task has a scheduled time, verify it's within work hours
      if (timeText && timeText.includes(":")) {
        // Extract hour from the time string (format: "Jan 15, 9:00 AM - 10:00 AM")
        const hourMatch = timeText.match(/(\d{1,2}):00\s*(AM|PM)/);
        if (hourMatch) {
          let hour = parseInt(hourMatch[1], 10);
          const period = hourMatch[2];

          // Convert to 24-hour format
          if (period === "PM" && hour !== 12) {
            hour += 12;
          } else if (period === "AM" && hour === 12) {
            hour = 0;
          }

          // Verify within work hours (9 AM = 9, 3 PM = 15)
          expect(hour).toBeGreaterThanOrEqual(9);
          expect(hour).toBeLessThan(15);
        }
      }
    }
  });

  test("tasks are scheduled according to energy level preference", async ({ page }) => {
    // Navigate to settings and configure energy preferences
    await page.goto("http://localhost:3001/settings#auto-schedule");
    await page.waitForSelector('text="Auto-Schedule Settings"', { timeout: 5000 });

    // Set work hours: 9 AM to 3 PM
    await page.locator("#work-hour-start").click();
    await page.getByRole("option", { name: "9:00 AM", exact: true }).click();
    await page.locator("#work-hour-end").click();
    await page.getByRole("option", { name: "3:00 PM", exact: true }).click();

    // Set High Energy Hours: 9 AM to 12 PM
    const highEnergyLabel = page.getByText("High Energy Hours", { exact: true });
    const highEnergyContainer = highEnergyLabel.locator("..");
    await highEnergyContainer.locator("button").first().click();
    await page.getByRole("option", { name: "9:00 AM", exact: true }).click();
    await highEnergyContainer.locator("button").nth(1).click();
    await page.getByRole("option", { name: "12:00 PM", exact: true }).click();

    // Set Low Energy Hours: 1 PM to 3 PM
    const lowEnergyLabel = page.getByText("Low Energy Hours", { exact: true });
    const lowEnergyContainer = lowEnergyLabel.locator("..");
    await lowEnergyContainer.locator("button").first().click();
    await page.getByRole("option", { name: "1:00 PM", exact: true }).click();
    await lowEnergyContainer.locator("button").nth(1).click();
    await page.getByRole("option", { name: "3:00 PM", exact: true }).click();

    // Navigate to tasks
    await page.goto("http://localhost:3001/tasks");

    // Create a high-energy task
    await page.locator(`button:has-text("New task")`).last().click();
    await page.waitForSelector('text="New Task"', { timeout: 5000 });
    await page.fill("#title", "Focus work");

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);
    const dueDateString = dueDate.toISOString().split("T")[0];
    await page.fill("#dueDate", dueDateString);
    await page.fill("#duration", "60");

    // Set energy level to HIGH
    await page.getByLabel("Energy Level").click();
    await page.getByRole("option", { name: "High", exact: true }).click();

    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);

    // Create a low-energy task
    await page.locator(`button:has-text("New task")`).last().click();
    await page.waitForSelector('text="New Task"', { timeout: 5000 });
    await page.fill("#title", "Admin work");
    await page.fill("#dueDate", dueDateString);
    await page.fill("#duration", "60");

    // Set energy level to LOW
    await page.getByLabel("Energy Level").click();
    await page.getByRole("option", { name: "Low", exact: true }).click();

    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);

    // Trigger auto-schedule
    await page.click('button:has-text("Auto-schedule")');
    await page.waitForTimeout(2000);

    // Verify high-energy task is scheduled in morning (9-12)
    const focusWorkRow = page.locator("text=Focus work").first();
    const focusTimeCell = focusWorkRow.locator("../td").nth(8);
    const focusTime = await focusTimeCell.textContent();

    // Should be between 9 AM and 12 PM
    expect(focusTime).toMatch(/(9|10|11):00\s*AM/);

    // Verify low-energy task is scheduled in afternoon (1-3 PM)
    const adminWorkRow = page.locator("text=Admin work").first();
    const adminTimeCell = adminWorkRow.locator("../td").nth(8);
    const adminTime = await adminTimeCell.textContent();

    // Should be between 1 PM and 3 PM
    expect(adminTime).toMatch(/(1|2):00\s*PM/);
  });
});
