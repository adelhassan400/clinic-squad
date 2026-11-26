import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { resolveApiBaseUrl } from "@/lib/api-routing";

// Preview isolation: on Vercel preview deployments the build bakes in the
// expected preview host and its isolated API base URL. Any other vercel.app
// host fails closed (unroutable origin) so a preview can never reach the
// production API through the vercel.json rewrite.
const apiBaseUrl = resolveApiBaseUrl(window.location.hostname, {
  expectedPreviewHost: import.meta.env.VITE_EXPECTED_PREVIEW_HOST as
    | string
    | undefined,
  previewApiBase: import.meta.env.VITE_PREVIEW_API_BASE as string | undefined,
});
if (apiBaseUrl) setBaseUrl(apiBaseUrl);

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
