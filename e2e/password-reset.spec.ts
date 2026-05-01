import { expect, test } from "@playwright/test";

test.describe("Password reset", () => {
  test("forgot password prompt validates email before sending", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /account/i }).click();
    await expect(page.getByRole("heading", { name: /student and owner access/i })).toBeVisible();

    await page.getByRole("button", { name: /forgot password/i }).click();

    await expect(page.getByText(/email required/i)).toBeVisible();
    await expect(page.getByText(/enter your account email first/i)).toBeVisible();
  });

  test("reset password page handles missing or expired reset link", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();

    const saveButton = page.getByRole("button", { name: /save password/i });
    const expiredLinkNotice = page.getByText(/missing, expired, or already used/i);

    await expect(saveButton.or(expiredLinkNotice)).toBeVisible();
  });

  test("expired Supabase reset link opens account dialog with a clear error", async ({
    page,
  }) => {
    await page.goto(
      "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    await expect(page.getByText(/reset link expired/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /student and owner access/i }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/otp_expired/);
  });

  test("recovery hash received on home redirects to reset password page", async ({
    page,
  }) => {
    await page.goto("/#type=recovery&access_token=test-token");

    await expect(page).toHaveURL(/\/reset-password#type=recovery/);
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
  });
});
