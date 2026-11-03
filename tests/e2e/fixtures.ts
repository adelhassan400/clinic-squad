import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

export const test = base.extend<{
  api: APIRequestContext;
  clinicAdmin: { token: string; clinicId: string; userId: string };
  doctor: { token: string; clinicId: string; userId: string };
  assistant: { token: string; clinicId: string; userId: string };
}>({
  api: async ({ playwright }, use, testInfo) => {
    const api = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL,
      extraHTTPHeaders: { "Content-Type": "application/json" },
    });
    await use(api);
    await api.dispose();
  },
  clinicAdmin: async ({ api }, use) => {
    const response = await api.post("/api/auth/login", { data: { email: "admin@demo.com", password: "demo1234" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    await use({ token: body.token, clinicId: body.user.clinicId, userId: body.user.id });
  },
  doctor: async ({ api }, use) => {
    const response = await api.post("/api/auth/login", { data: { email: "doctor@demo.com", password: "demo1234" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    await use({ token: body.token, clinicId: body.user.clinicId, userId: body.user.id });
  },
  assistant: async ({ api }, use) => {
    const response = await api.post("/api/auth/login", { data: { email: "assistant@demo.com", password: "demo1234" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    await use({ token: body.token, clinicId: body.user.clinicId, userId: body.user.id });
  },
});

export { expect };

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function loginInBrowser(page: Page, email = "admin@demo.com", password = "demo1234") {
  await page.goto("/login");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-submit").click();
}
