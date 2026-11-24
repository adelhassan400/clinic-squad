import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveApiBaseUrl,
  previewBuildEnv,
  branchSlug,
  branchAliasHost,
  FAIL_CLOSED_BASE_URL,
  PRODUCTION_HOST,
  TEAM_SCOPE,
} from "./api-routing.ts";

const PREVIEW = previewBuildEnv("uifix");
// expectedPreviewHost = clinic-squad-git-uifix-ahmed64653234-6553s-projects.vercel.app
// previewApiBase = https://clinic-squad-api-server-git-uifix-ahmed64653234-6553s-projects.vercel.app

test("branchSlug normalizes branch names", () => {
  assert.equal(branchSlug("uifix"), "uifix");
  assert.equal(branchSlug("Feat/My Thing"), "feat-my-thing");
  assert.equal(branchSlug("--x--"), "x");
});

test("aliases fit the 63-character DNS label limit at the slug budget", () => {
  const slug = "a".repeat(5);
  const firstLabel = (host: string) => host.split(".")[0];
  assert.ok(firstLabel(branchAliasHost("clinic-squad", slug)).length <= 63);
  assert.ok(firstLabel(branchAliasHost("clinic-squad-api-server", slug)).length <= 63);
});

test("previewBuildEnv rejects long or missing branches (fail closed at build time)", () => {
  assert.throws(() => previewBuildEnv(undefined));
  assert.throws(() => previewBuildEnv("feat/usability-improvements"));
  assert.throws(() => previewBuildEnv("abcdef"));
});

test("production host uses the same-origin rewrite", () => {
  assert.equal(resolveApiBaseUrl(PRODUCTION_HOST, PREVIEW), null);
  assert.equal(resolveApiBaseUrl(PRODUCTION_HOST, {}), null);
});

test("local development hosts use the dev proxy", () => {
  assert.equal(resolveApiBaseUrl("localhost", PREVIEW), null);
  assert.equal(resolveApiBaseUrl("127.0.0.1", PREVIEW), null);
});

test("the expected preview branch alias uses same-origin /api (vercel.json proxies it to the preview API)", () => {
  assert.equal(resolveApiBaseUrl(PREVIEW.expectedPreviewHost, PREVIEW), null);
  assert.ok(PREVIEW.previewApiBase.includes(TEAM_SCOPE));
});

test("random per-deployment preview URLs fail closed, never production", () => {
  assert.equal(
    resolveApiBaseUrl(`clinic-squad-fqlxlwhqu-${TEAM_SCOPE}.vercel.app`, PREVIEW),
    FAIL_CLOSED_BASE_URL,
  );
});

test("other branches' aliases fail closed", () => {
  assert.equal(
    resolveApiBaseUrl(`clinic-squad-git-other-${TEAM_SCOPE}.vercel.app`, PREVIEW),
    FAIL_CLOSED_BASE_URL,
  );
});

test("hashed long-branch aliases fail closed", () => {
  assert.equal(
    resolveApiBaseUrl(`clinic-squad-git-fix-verifi-335940-${TEAM_SCOPE}.vercel.app`, PREVIEW),
    FAIL_CLOSED_BASE_URL,
  );
});

test("any vercel.app host without baked preview config fails closed", () => {
  assert.equal(resolveApiBaseUrl(`clinic-squad-git-uifix-${TEAM_SCOPE}.vercel.app`, {}), FAIL_CLOSED_BASE_URL);
  assert.equal(resolveApiBaseUrl(`anything-else.vercel.app`, {}), FAIL_CLOSED_BASE_URL);
});

test("non-Vercel hosts keep the same-origin default", () => {
  assert.equal(resolveApiBaseUrl("clinicsquad.example.com", PREVIEW), null);
});
