// Preview API routing for Vercel deployments.
//
// Production is served at clinic-squad.vercel.app and uses the same-origin
// /api rewrite in vercel.json, which targets the production API. Preview
// deployments must NEVER use that rewrite: they get a build-time-baked
// preview API base URL derived from the git branch name (Vercel branch
// aliases are deterministic only for short branch slugs). Any vercel.app
// host we do not recognize fails closed to an unroutable origin, so a
// preview can never silently read or write the production database.

export const PRODUCTION_HOST = "clinic-squad.vercel.app";
export const TEAM_SCOPE = "ahmed64653234-6553s-projects";
export const FRONTEND_PROJECT = "clinic-squad";
export const API_PROJECT = "clinic-squad-api-server";
// RFC 2606 reserved TLD that never resolves: the fail-closed target.
export const FAIL_CLOSED_BASE_URL = "https://preview-unavailable.invalid";

// Vercel builds a git branch alias as <project>-git-<branch-slug>-<scope>
// and the hostname must fit in 63 characters, so the slug budget depends on
// the project name. The API project name is the longer one here; past the
// budget Vercel truncates the slug and inserts an unpredictable hash, which
// would break isolation. The build refuses longer branch names instead.
export const MAX_BRANCH_SLUG_LENGTH = 5;

export function branchSlug(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function branchAliasHost(project: string, slug: string): string {
  return `${project}-git-${slug}-${TEAM_SCOPE}.vercel.app`;
}

export type PreviewBuildEnv = {
  expectedPreviewHost: string;
  previewApiBase: string;
};

// Computed at build time from Vercel system environment variables
// (VERCEL_GIT_COMMIT_REF). Throws, failing the build, when the branch
// cannot produce deterministic aliases: a preview that cannot name its own
// API must never deploy.
export function previewBuildEnv(branch: string | undefined): PreviewBuildEnv {
  if (!branch) {
    throw new Error(
      "VERCEL_GIT_COMMIT_REF is required for preview builds to configure the isolated preview API.",
    );
  }
  const slug = branchSlug(branch);
  if (!slug || slug.length > MAX_BRANCH_SLUG_LENGTH) {
    throw new Error(
      `Preview branch "${branch}" (slug "${slug}") is too long for deterministic Vercel aliases; ` +
        `use a branch name whose slug is at most ${MAX_BRANCH_SLUG_LENGTH} characters so previews stay isolated.`,
    );
  }
  return {
    expectedPreviewHost: branchAliasHost(FRONTEND_PROJECT, slug),
    previewApiBase: `https://${branchAliasHost(API_PROJECT, slug)}`,
  };
}

export type RuntimeEnv = {
  expectedPreviewHost?: string;
  previewApiBase?: string;
};

// Returns the API base URL to use, or null for the default same-origin /api.
export function resolveApiBaseUrl(host: string, env: RuntimeEnv): string | null {
  // Production and local development use the same-origin rewrite/proxy.
  if (host === PRODUCTION_HOST) return null;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return null;
  if (host.endsWith(".vercel.app")) {
    if (env.expectedPreviewHost && env.previewApiBase && host === env.expectedPreviewHost) {
      // Same-origin /api: vercel.json forwards only this host to the preview API with a
      // server-side bypass header; every other non-production host is denied there.
      return null;
    }
    // Any other Vercel host (random per-deployment URLs, other branches,
    // stale aliases): fail closed rather than reach the production API.
    return FAIL_CLOSED_BASE_URL;
  }
  // Non-Vercel hosts (tunnels, future custom domains) keep the same-origin
  // default; they are not Vercel preview deployments.
  return null;
}
