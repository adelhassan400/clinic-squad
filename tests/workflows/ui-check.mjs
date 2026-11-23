// Runs the real PostgreSQL handlers, plus the production browser bundle.
import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const children = [];
function start(command, args, env) {
  const p = spawn(command, args, {
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(p);
  p.stderr.on("data", (d) => process.stderr.write(d));
  return p;
}
const apiBase = "http://127.0.0.1:8081";
async function req(p, token, body, method = body ? "POST" : "GET") {
  const r = await fetch(apiBase + "/api" + p, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(r.ok, `${r.status} ${await r.clone().text()}`);
  return r.status === 204 ? null : r.json();
}
let browser;
try {
  start("node", ["artifacts/api-server/dist/index.mjs"], {
    PORT: "8081",
    DATABASE_URL: process.env.DATABASE_URL,
  });
  start("pnpm", ["--filter", "@workspace/clinic-squad", "run", "serve"], {
    PORT: "5100",
    BASE_PATH: "/",
  });
  for (const url of [apiBase + "/api/healthz", "http://127.0.0.1:5100"]) {
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, url);
  }
  const auth = await req("/auth/register", null, {
    email: `uitest-${Date.now()}@example.com`,
    password: "test password is long",
    clinicName: "Test Clinic",
    ownerName: "Test Doctor",
    specialty: "General Medicine",
    whatsappNumber: "+201000000000",
  });
  const clinic = auth.user.clinicId;
  execFileSync("psql", [
    process.env.DATABASE_URL,
    "-c",
    `update clinics set status='active' where id='${clinic}'; update users set email_verified_at=now() where id='${auth.user.id}'`,
  ]);
  const me = await req("/auth/me", auth.token);
  const state = {
    user: me.user ?? me,
    clinic: { ...auth.clinic, status: "active" },
    token: auth.token,
  };
  const p = await req(
    `/clinics/${clinic}/patients/register-and-queue`,
    auth.token,
    {
      name: "First Patient",
      phone: "01000000000",
      age: 30,
      doctorId: auth.user.id,
      cashCollected: true,
      collectedAmount: 200,
      visitType: "New Consultation",
    },
  );
  const p2 = await req(
    `/clinics/${clinic}/patients/register-and-queue`,
    auth.token,
    {
      name: "Second Patient",
      phone: "01000000001",
      age: 40,
      doctorId: auth.user.id,
      cashCollected: true,
      collectedAmount: 200,
      visitType: "New Consultation",
    },
  );
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Production preview proxy defaults to port 8080. Route to this isolated API.
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    await route.continue({ url: apiBase + u.pathname + u.search });
  });
  await page.addInitScript((s) => {
    localStorage.setItem("clinicsquad_auth", JSON.stringify(s));
    localStorage.setItem("clinicsquad_lang", "en");
  }, state);
  await page.goto(`http://127.0.0.1:5100/patients/${p.id}`);
  await page.getByTestId("input-diagnosis").waitFor();
  let fail = true;
  await page.route(
    `**/api/clinics/${clinic}/patients/${p.id}`,
    async (route) => {
      if (
        route.request().method() === "PATCH" &&
        route.request().postDataJSON()?.diagnosis &&
        fail
      ) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Test offline" }),
        });
      }
      const u = new URL(route.request().url());
      await route.continue({ url: apiBase + u.pathname + u.search });
    },
  );
  await page.getByTestId("input-diagnosis").fill("Saved diagnosis for first");
  await page
    .getByTestId("input-clinical-notes")
    .fill("Notes belong only to first");
  await page
    .getByTestId("consultation-save-status")
    .filter({ hasText: "Save failed" })
    .waitFor();
  await page.getByRole("link", { name: /Back to Waiting List/ }).click();
  await page.waitForTimeout(200);
  assert.ok(page.url().endsWith(p.id), "failed save must block navigation");
  await page.screenshot({
    path: "/downloads/clinic-save-retry.png",
    fullPage: true,
  });
  fail = false;
  await page.getByTestId("button-retry-save").click();
  await page
    .getByTestId("consultation-save-status")
    .filter({ hasText: /^Saved$/ })
    .waitFor();
  await page
    .getByTestId("input-diagnosis")
    .fill("Latest diagnosis before navigation");
  await page.getByRole("link", { name: /Back to Waiting List/ }).click();
  await page.getByTestId(`waiting-row-${p.id}`).waitFor();
  const saved = await req(`/clinics/${clinic}/patients/${p.id}`, auth.token);
  assert.equal(saved.diagnosis, "Latest diagnosis before navigation");
  await page.screenshot({
    path: "/downloads/clinic-queue.png",
    fullPage: true,
  });
  await page.getByTestId(`waiting-row-${p2.id}`).getByRole("button").click();
  await page.getByTestId("input-diagnosis").waitFor();
  assert.equal(await page.getByTestId("input-diagnosis").inputValue(), "");
  assert.equal(await page.getByTestId("input-clinical-notes").inputValue(), "");
  await page.getByTestId("input-diagnosis").fill("Second patient edit");

  await page.goBack();
  await page.getByTestId(`waiting-row-${p2.id}`).waitFor();
  const saved2 = await req(`/clinics/${clinic}/patients/${p2.id}`, auth.token);
  assert.equal(saved2.diagnosis, "Second patient edit");
  assert.deepEqual(errors, []);
  console.log(
    "UI PASS: failed-save navigation block, visible retry, latest-write flush, patient state reset, browser Back flush; screenshots saved.",
  );
} finally {
  await browser?.close();
  for (const p of children) { try { process.kill(-p.pid, "SIGTERM"); } catch {} }
  setTimeout(() => process.exit(), 500).unref();
    }
