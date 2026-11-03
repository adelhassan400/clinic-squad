import { test, expect, authHeaders, loginInBrowser } from "./fixtures";

test.describe("Authentication", () => {
  test("logs in through the browser and reaches the clinic dashboard", async ({ page }) => {
    await loginInBrowser(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test("logs in as Super Admin and reaches the platform dashboard", async ({ page }) => {
    await loginInBrowser(page, "super@clinicsquad.com", "super1234");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("rejects invalid credentials", async ({ api }) => {
    const response = await api.post("/api/auth/login", { data: { email: "admin@demo.com", password: "incorrect" } });
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid credentials" });
  });

  test("protects clinic routes and rejects invalid tokens", async ({ page, api, clinicAdmin }) => {
    await page.goto("/patients");
    await expect(page).toHaveURL(/\/login$/);

    const response = await api.get("/api/auth/me", { headers: authHeaders(`${clinicAdmin.token}-invalid`) });
    expect(response.status()).toBe(401);
  });

  test("logs out and clears the browser session", async ({ page }) => {
    await loginInBrowser(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByTestId("button-logout").click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });
});
