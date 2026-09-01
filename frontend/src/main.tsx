import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminPanel } from "./components/admin-panel";
import { ComingSoon } from "./components/coming-soon";
import { FlohmarktApp } from "./components/flohmarkt-app";
import { checkPreviewUnlockFromUrl, isPreviewUnlocked } from "./lib/preview-unlock";
import "./style.css";

// Vor jedem anderen Rendern prüfen - setzt ggf. das Freischalt-Flag und
// entfernt den Bypass-Parameter wieder aus der URL (siehe preview-unlock.ts).
checkPreviewUnlockFromUrl();

function isLaunched(launchAt: string | null): boolean {
  if (!launchAt) return false;
  const target = new Date(launchAt).getTime();
  return !Number.isNaN(target) && target <= Date.now();
}

function App() {
  const [isAdmin, setIsAdmin] = useState(window.location.hash === "#admin");
  // Reiner Frontend-Zustand, kein Netzwerk nötig - wer die App schon einmal
  // per Bypass-Link geöffnet hat, sieht sie ab sofort immer, unabhängig vom
  // Startdatum.
  const [unlocked] = useState(isPreviewUnlocked());
  // undefined = /launch-config noch nicht beantwortet - bis dahin lieber
  // vorsichtig den Platzhalter zeigen (kein Aufblitzen der echten App, falls
  // sie eigentlich noch verborgen sein sollte) statt eines Spinners.
  const [launchAt, setLaunchAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const onHash = () => setIsAdmin(window.location.hash === "#admin");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    // Bereits freigeschaltet - Startdatum spielt keine Rolle mehr, Fetch spart sich.
    if (unlocked) return;
    fetch(`${import.meta.env.VITE_API_URL ?? ""}/launch-config`)
      .then((r) => (r.ok ? r.json() : { launch_at: null }))
      .then((data: { launch_at: string | null }) => setLaunchAt(data.launch_at))
      .catch(() => setLaunchAt(null));
  }, [unlocked]);

  if (!unlocked && !isLaunched(launchAt ?? null)) {
    return <ComingSoon launchAt={launchAt ?? null} />;
  }
  return isAdmin ? <AdminPanel /> : <FlohmarktApp />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
