import { useCallback, useEffect, useState } from "react";
import { type OwnStand, fetchStands } from "../api";
import type { Stand } from "../types";
import { Datenschutz } from "./datenschutz";
import { Faq } from "./faq";
import { Footer, PORTAL_URL } from "./footer";
import { Impressum } from "./impressum";
import { MapOrList } from "./map-or-list";
import { MeinStand } from "./mein-stand";
import { KATEGORIEN } from "./stand-form";
import { StandForm } from "./stand-form";
import { StandListe } from "./stand-liste";

const EVENT_DATE = new Date("2026-10-04T10:00:00+02:00");

type Page = "main" | "faq" | "impressum" | "datenschutz";

function pageFromHash(): Page {
  switch (window.location.hash) {
    case "#faq":
      return "faq";
    case "#impressum":
      return "impressum";
    case "#datenschutz":
      return "datenschutz";
    default:
      return "main";
  }
}

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
    "DTSTART:20261004T080000Z",
    "DTEND:20261004T140000Z",
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

function Header({ page }: { page: Page }) {
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
        href="#mein-stand"
        className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800"
      >
        Mein Stand
      </a>
      <a
        href="#faq"
        className={`text-sm transition-colors ${page === "faq" ? "font-semibold text-[#009a00]" : "text-gray-500 hover:text-gray-700"}`}
      >
        Regeln & FAQ
      </a>
      <a
        href="#impressum"
        className={`text-sm transition-colors ${page === "impressum" ? "font-semibold text-[#009a00]" : "text-gray-500 hover:text-gray-700"}`}
      >
        Impressum
      </a>
    </header>
  );
}

export function FlohmarktApp() {
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [kategorienFilter, setKategorienFilter] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [hasOwnStand, setHasOwnStand] = useState(false);

  const handleStandChange = useCallback((stand: OwnStand | null) => {
    setHasOwnStand(stand !== null);
    if (stand !== null) setShowForm(false);
  }, []);

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
    const onHash = () => setPage(pageFromHash());
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
      ) : page === "impressum" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <Impressum />
        </main>
      ) : page === "datenschutz" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <Datenschutz />
        </main>
      ) : (
        <main className="flex-1">
          {/* Karte als Startseite – volle Breite, prominent */}
          <div className="relative w-full" style={{ height: "min(65vh, 520px)" }}>
            <MapOrList
              kategorienFilter={kategorienFilter}
              stands={filteredStands}
              loading={loading}
            />
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
                  Sonntag, 4. Oktober 2026 · 10:00 – 16:00 Uhr
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
            <MeinStand onCancelled={loadStands} onStandChange={handleStandChange} />

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

            {!hasOwnStand && (
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
            )}
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}
