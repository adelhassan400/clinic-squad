import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

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
