import { useCallback, useEffect, useState } from "react";
import { fetchStands } from "../api";
import type { Stand } from "../types";
import { Faq } from "./faq";
import { FlohmarktMap } from "./flohmarkt-map";
import { MeinStand } from "./mein-stand";
import { KATEGORIEN } from "./stand-form";
import { StandForm } from "./stand-form";
import { StandListe } from "./stand-liste";

const PORTAL_URL = "https://portal.openzirndorf.de/";
const IMPRESSUM_URL = "https://portal.openzirndorf.de/#impressum";
const EVENT_DATE = new Date("2026-04-26T10:00:00+02:00");

const MASKOTTCHEN = [
  { datei: "tuxi.png", name: "Tuxi", text: "Tuxi holt schon die Daten vom Server…" },
  { datei: "fynn.png", name: "Fynn", text: "Fynn tippt auf Hochtouren…" },
  { datei: "kreiselix.png", name: "Kreiselix", text: "Kreiselix dreht die Stände auf…" },
  { datei: "horst.png", name: "Horst", text: "Horst kennt das Geheimnis – gleich ist er da…" },
  { datei: "paul.png", name: "Paul", text: "Paul begrüßt alle neuen Stände herzlich…" },
  { datei: "nico.png", name: "Nico", text: "Nico lädt die Karte…" },
  { datei: "quirin.png", name: "Quirin", text: "Quirin spielt schon zur Eröffnung auf…" },
];

const MASCOT_BASE = "https://openzirndorf.de/static/media/maskottchen/";

function MascotLoading() {
  const mascot = MASKOTTCHEN[Math.floor(Math.random() * MASKOTTCHEN.length)];
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white">
      <img
        src={`${MASCOT_BASE}${mascot.datei}`}
        alt={mascot.name}
        className="h-40 w-40 object-contain drop-shadow-md"
      />
      <p
        style={{ fontFamily: "var(--oz-font-heading)" }}
        className="text-lg font-bold text-gray-700"
      >
        {mascot.text}
      </p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-[#009a00]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function daysUntilEvent(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((EVENT_DATE.getTime() - today.getTime()) / 86_400_000);
}

function downloadICS() {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenZirndorf//Garagenflohmarkt//DE",
    "BEGIN:VEVENT",
    "DTSTART:20260426T080000Z",
    "DTEND:20260426T140000Z",
    "SUMMARY:Garagenflohmarkt Zirndorf",
    "DESCRIPTION:Stadtgebietsweiter Garagenflohmarkt in Zirndorf",
    "LOCATION:Zirndorf\\, Bayern",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "garagenflohmarkt-zirndorf.ics";
  a.click();
  URL.revokeObjectURL(a.href);
}

function OzLogo() {
  return (
    <img
      src="https://openzirndorf.de/static/media/logo.png"
      alt="OpenZirndorf"
      width={28}
      height={28}
      className="rounded-md"
    />
  );
}

function Header({ page }: { page: string }) {
  const goHome = () => {
    window.location.hash = "";
  };
  return (
    <header
      style={{ height: "var(--oz-header-height)" }}
      className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100 bg-white px-4"
    >
      <button type="button" onClick={goHome} className="mr-auto flex items-center gap-2">
        <OzLogo />
        <span
          style={{ fontFamily: "var(--oz-font-heading)" }}
          className="text-lg font-extrabold leading-none"
        >
          Garagenflohmarkt <span className="text-[#009a00]">Zirndorf</span>
        </span>
      </button>
      <a href={PORTAL_URL} className="hidden text-sm text-gray-400 hover:text-gray-600 sm:block">
        OpenZirndorf ↗
      </a>
      <a
        href="#faq"
        className={`text-sm transition-colors ${page === "faq" ? "font-semibold text-[#009a00]" : "text-gray-500 hover:text-gray-700"}`}
      >
        Regeln & FAQ
      </a>
      <a
        href={IMPRESSUM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        Impressum
      </a>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t text-sm text-gray-500">
      <div className="mx-auto flex max-w-4xl flex-wrap justify-between gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <a href={PORTAL_URL} className="flex items-center gap-2 no-underline">
            <img
              src="https://openzirndorf.de/static/media/logo.png"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span style={{ fontFamily: "var(--oz-font-heading)" }} className="font-extrabold">
              <span className="text-gray-400">open</span>
              <span className="text-[#009a00]">zirndorf</span>
            </span>
          </a>
          <p className="text-xs text-gray-400">Digitale Möglichkeiten für Zirndorf.</p>
        </div>

        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col gap-1">
            <strong className="text-gray-700">Digitale Angebote</strong>
            <a
              href={PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              Alle Angebote
            </a>
            <a
              href="https://wahl2026.openzirndorf.de/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              Wahlanalyse 2026
            </a>
            <a
              href="https://ideen.openzirndorf.de/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              Ideenbörse
            </a>
          </div>
          <div className="flex flex-col gap-1">
            <strong className="text-gray-700">Community</strong>
            <a
              href="https://join.slack.com/t/openzirndorf/shared_invite/zt-3qt1trev5-UZDu3QpOfFfLKcIQTndZ6Q"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              Slack
            </a>
            <a
              href="https://github.com/openzirndorf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              GitHub
            </a>
            <a
              href="https://instagram.com/openzirndorf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              Instagram
            </a>
          </div>
          <div className="flex flex-col gap-1">
            <strong className="text-gray-700">Rechtliches</strong>
            <a
              href={IMPRESSUM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              Impressum
            </a>
            <a
              href="https://openzirndorf.de/datenschutz.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#009a00]"
            >
              Datenschutz
            </a>
            <a href="#faq" className="hover:text-[#009a00]">
              Regeln & FAQ
            </a>
          </div>
        </div>
      </div>
      <div className="border-t px-4 py-3 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} OpenZirndorf · Entwickelt mit ❤️ in Zirndorf
      </div>
    </footer>
  );
}

export function FlohmarktApp() {
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => (window.location.hash === "#faq" ? "faq" : "main"));
  const [kategorienFilter, setKategorienFilter] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);

  const loadStands = useCallback(async () => {
    setLoading(true);
    try {
      setStands(await fetchStands());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStands();
  }, [loadStands]);

  useEffect(() => {
    const onHash = () => setPage(window.location.hash === "#faq" ? "faq" : "main");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const toggleFilter = (k: string) => {
    setKategorienFilter((prev) => (prev.includes(k) ? prev.filter((c) => c !== k) : [...prev, k]));
  };

  const filteredStands =
    kategorienFilter.length === 0
      ? stands
      : stands.filter((s) => s.kategorien.some((k) => kategorienFilter.includes(k)));

  const initialLoading = loading && stands.length === 0;

  return (
    <div className="flex min-h-screen flex-col">
      {initialLoading && <MascotLoading />}
      <Header page={page} />

      {page === "faq" ? (
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
          <Faq />
        </main>
      ) : (
        <main className="flex-1">
          {/* Karte als Startseite – volle Breite, prominent */}
          <div className="relative w-full" style={{ height: "min(65vh, 520px)" }}>
            <FlohmarktMap kategorienFilter={kategorienFilter} />
            {/* Kategorie-Filter-Overlay */}
            <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center px-4">
              <div className="flex flex-wrap justify-center gap-1.5 rounded-2xl bg-white/90 px-3 py-2 shadow-md backdrop-blur-sm">
                {KATEGORIEN.map((k) => {
                  const active = kategorienFilter.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleFilter(k)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-[#009a00] bg-[#009a00] text-white"
                          : "border-gray-300 bg-white text-gray-600 hover:border-[#009a00] hover:text-[#009a00]"
                      }`}
                    >
                      {k}
                    </button>
                  );
                })}
                {kategorienFilter.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setKategorienFilter([])}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    ✕ Alle
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Event-Info-Banner */}
          <div className="border-b border-green-100 bg-green-50 px-4 py-3">
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold text-[#009a00]">
                  Sonntag, 26. April 2026 · 10:00 – 16:00 Uhr
                </p>
                {daysUntilEvent() > 0 && (
                  <span className="text-xs text-green-600">in {daysUntilEvent()} Tagen</span>
                )}
              </div>
              <button
                type="button"
                onClick={downloadICS}
                className="text-xs text-green-700 underline-offset-2 hover:underline"
              >
                + Kalender
              </button>
            </div>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
            <MeinStand onCancelled={loadStands} />

            <section aria-label="Alle Stände">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2
                  style={{ fontFamily: "var(--oz-font-heading)" }}
                  className="flex items-center gap-2 text-xl font-bold"
                >
                  Angemeldete Stände
                  {!loading && stands.length > 0 && (
                    <span className="text-sm font-normal text-gray-400">
                      ({filteredStands.length}
                      {kategorienFilter.length > 0 ? ` von ${stands.length}` : ""})
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {KATEGORIEN.map((k) => {
                    const active = kategorienFilter.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleFilter(k)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-[#009a00] bg-[#009a00] text-white"
                            : "border-gray-200 bg-white text-gray-500 hover:border-[#009a00] hover:text-[#009a00]"
                        }`}
                      >
                        {k}
                      </button>
                    );
                  })}
                  {kategorienFilter.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setKategorienFilter([])}
                      className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <StandListe stands={filteredStands} loading={loading} />
            </section>

            <section aria-label="Stand anmelden">
              {showForm ? (
                <StandForm
                  onSuccess={() => {
                    loadStands();
                    setShowForm(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="w-full rounded-xl border-2 border-dashed border-[#009a00] py-4 text-sm font-semibold text-[#009a00] transition-colors hover:bg-green-50"
                >
                  + Eigenen Stand anmelden
                </button>
              )}
            </section>
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}
