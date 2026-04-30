import { expect, test } from "@playwright/test";

test.describe("Public smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /find your/i }),
    ).toBeVisible();
    await expect(page.getByText(/properties/i)).toBeVisible();
  });

  test("list page and listing details load", async ({ page, request }) => {
    const apiResponse = await request.get("/api/listings?page=1&pageSize=1");
    expect(apiResponse.ok()).toBeTruthy();

    const payload = (await apiResponse.json()) as {
      items?: Array<{ id: string; title: string }>;
    };
    const firstListing = payload.items?.[0];
    expect(firstListing?.id).toBeTruthy();

    await page.goto("/list");
    await expect(page.getByRole("heading", { name: /search/i })).toBeVisible();
    await expect(page.getByText(/properties found/i)).toBeVisible();

    await page.goto(`/listing/${firstListing!.id}`);
    await expect(page.getByRole("heading", { name: /about this place/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /request booking/i })).toBeVisible();
  });

  test("dashboard is protected without session", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/dashboard unavailable/i)).toBeVisible();
  });

  test("text inputs keep focus while typing", async ({ page }) => {
    await page.goto("/list");

    await page.getByRole("button", { name: /open search/i }).click();
    const searchInput = page.getByPlaceholder(/search condos/i);
    await searchInput.click();

    for (const char of "condo") {
      await page.keyboard.type(char);
      await expect(searchInput).toBeFocused();
    }
    await expect(searchInput).toHaveValue("condo");

    await page.getByRole("button", { name: /account/i }).click();
    const emailInput = page.locator("#sign-in-email");
    await emailInput.click();

    for (const char of "student@example.com") {
      await page.keyboard.type(char);
      await expect(emailInput).toBeFocused();
    }
    await expect(emailInput).toHaveValue("student@example.com");
  });
});
