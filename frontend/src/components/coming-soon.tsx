import { type ReactNode, useEffect, useState } from "react";
import { Datenschutz } from "./datenschutz";
import { Faq } from "./faq";
import { Footer, PORTAL_URL } from "./footer";
import { Impressum } from "./impressum";

// Zeigt sich, solange die App noch nicht öffentlich gestartet ist (siehe
// main.tsx: Gate vor FlohmarktApp/AdminPanel) - Impressum/Datenschutz/FAQ
// müssen aber schon vorher erreichbar sein (Impressumspflicht gilt
// unabhängig vom Start), deshalb ein eigener, kleiner Hash-Router hier
// statt die komplette FlohmarktApp für diese drei Seiten mitzuladen.
function LegalPage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <button
        type="button"
        onClick={() => {
          window.location.hash = "";
        }}
        className="mb-6 text-sm text-[#009a00] hover:underline"
      >
        ← Zurück
      </button>
      {children}
    </main>
  );
}

function useCountdown(launchAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!launchAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [launchAt]);

  if (!launchAt) return null;
  const target = new Date(launchAt).getTime();
  const diffMs = target - now;
  if (Number.isNaN(target) || diffMs <= 0) return null;

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        style={{ fontFamily: "var(--oz-font-heading)" }}
        className="text-3xl font-extrabold text-[#009a00] tabular-nums"
      >
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// launchAt kommt von main.tsx (einmaliger /launch-config-Fetch dort, siehe
// App()) statt hier selbst noch einmal zu laden - main.tsx braucht den Wert
// ohnehin schon für die Freischalt-Entscheidung selbst.
function Placeholder({ launchAt }: { launchAt: string | null }) {
  const countdown = useCountdown(launchAt);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <img
        src="https://openzirndorf.de/static/media/logo.png"
        alt="OpenZirndorf"
        width={72}
        height={72}
        className="rounded-xl"
      />
      <div>
        <h1
          style={{ fontFamily: "var(--oz-font-heading)" }}
          className="text-3xl font-extrabold text-gray-900"
        >
          Garagenflohmarkt Zirndorf
        </h1>
        <p className="mt-2 max-w-md text-gray-500">
          {countdown
            ? "Die Standanmeldung startet bald - schau in Kürze wieder vorbei!"
            : "Wir bereiten gerade alles vor - schau bald wieder vorbei!"}
        </p>
      </div>
      {countdown && (
        <div className="flex gap-6 rounded-2xl border border-gray-100 bg-white px-6 py-4 shadow-sm">
          <CountdownBlock value={countdown.days} label="Tage" />
          <CountdownBlock value={countdown.hours} label="Std" />
          <CountdownBlock value={countdown.minutes} label="Min" />
        </div>
      )}
      <p className="max-w-sm text-xs text-gray-400">
        Der Garagenflohmarkt ist ein ehrenamtliches Projekt von{" "}
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600"
        >
          OpenZirndorf
        </a>{" "}
        - mehr über die Initiative und wie du sie unterstützen kannst gibt's dort.
      </p>
    </div>
  );
}

export function ComingSoon({ launchAt }: { launchAt: string | null }) {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  let page: ReactNode;
  if (hash === "#impressum") {
    page = (
      <LegalPage>
        <Impressum />
      </LegalPage>
    );
  } else if (hash === "#datenschutz") {
    page = (
      <LegalPage>
        <Datenschutz />
      </LegalPage>
    );
  } else if (hash === "#faq") {
    page = (
      <LegalPage>
        <Faq />
      </LegalPage>
    );
  } else {
    page = <Placeholder launchAt={launchAt} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {page}
      <Footer />
    </div>
  );
}
