import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// Preview isolation: on Vercel preview deployments (git branch alias hosts),
// call the matching preview deployment of the API server instead of the
// production API that vercel.json rewrites /api to. Vercel branch aliases look
// like <project>-git-<branch-slug>-<team-scope>.vercel.app; when the full slug
// does not fit in 63 chars, Vercel truncates it and appends a 6-char hash
// (the API project's longer name then keeps only the hash).
const FRONTEND_ALIAS_PREFIX = "clinic-squad-git-";
const API_ALIAS_PREFIX = "clinic-squad-api-server-git-";
const TEAM_SCOPE = "ahmed64653234-6553s-projects";
{
  const host = window.location.hostname;
  const suffix = `-${TEAM_SCOPE}.vercel.app`;
  if (host.startsWith(FRONTEND_ALIAS_PREFIX) && host.endsWith(suffix)) {
    const branchPart = host.slice(FRONTEND_ALIAS_PREFIX.length, -suffix.length);
    const hashMatch = branchPart.match(/-([a-z0-9]{6})$/);
    const apiBranchPart = hashMatch ? hashMatch[1] : branchPart;
    setBaseUrl(`https://${API_ALIAS_PREFIX}${apiBranchPart}${suffix.replace(".vercel.app", "")}.vercel.app`);
  }
}

setAuthTokenGetter(() => {
  try {
    const stored = localStorage.getItem("clinicsquad_auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
