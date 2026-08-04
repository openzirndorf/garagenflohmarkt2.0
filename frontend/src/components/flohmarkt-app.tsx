import { useCallback, useEffect, useRef, useState } from "react";
import { type OwnStand, fetchStands } from "../api";
import { useFavorites } from "../lib/favorites";
import type { Stand } from "../types";
import { Datenschutz } from "./datenschutz";
import { Faq } from "./faq";
import { Footer, PORTAL_URL } from "./footer";
import { Impressum } from "./impressum";
import { InstallPrompt } from "./install-prompt";
import { MapOrList } from "./map-or-list";
import { MeinStand } from "./mein-stand";
import { KATEGORIEN } from "./stand-form";
import { StandForm } from "./stand-form";
import { StandListe } from "./stand-liste";

const EVENT_DATE = new Date("2026-10-04T10:00:00+02:00");

type Page = "main" | "faq" | "impressum" | "datenschutz" | "stand-anmelden" | "mein-stand";

function pageFromHash(): Page {
  const hash = window.location.hash;
  if (hash === "#faq") return "faq";
  if (hash === "#impressum") return "impressum";
  if (hash === "#datenschutz") return "datenschutz";
  if (hash === "#stand-anmelden") return "stand-anmelden";
  // Der Magic-Link landet als "#mein-stand/session/{token}", nicht als
  // exakter Match - siehe consumeSessionTokenFromHash() in mein-stand.tsx.
  if (hash.startsWith("#mein-stand")) return "mein-stand";
  return "main";
}

function BackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.hash = "";
      }}
      className="mb-6 text-sm text-[#009a00] hover:underline"
    >
      ← Zurück
    </button>
  );
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

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="2" y1="5" x2="18" y2="5" />
      <line x1="2" y1="10" x2="18" y2="10" />
      <line x1="2" y1="15" x2="18" y2="15" />
    </svg>
  );
}

function Header({ page, hasOwnStand }: { page: Page; hasOwnStand: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const goHome = () => {
    window.location.hash = "";
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Schließt das Menü bei jeder Hash-Navigation (Klick auf einen der Links
  // unten) - onClick direkt an den Anker-Elementen würde biomes
  // a11y/useValidAnchor-Regel verletzen ("Anchor statt Button").
  useEffect(() => {
    const handleHashChange = () => setMenuOpen(false);
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const menuLinkClass = (active: boolean) =>
    `block px-4 py-2 text-sm hover:bg-gray-50 ${active ? "font-semibold text-[#009a00]" : "text-gray-700"}`;

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
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menü"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <MenuIcon />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
            {!hasOwnStand && (
              <a href="#stand-anmelden" className={menuLinkClass(page === "stand-anmelden")}>
                📍 Eigenen Stand anmelden
              </a>
            )}
            <a href="#mein-stand" className={menuLinkClass(page === "mein-stand")}>
              🔑 Mein Stand
            </a>
            <div className="my-1 border-t border-gray-100" />
            <a href="#faq" className={menuLinkClass(page === "faq")}>
              Regeln & FAQ
            </a>
            <a href="#impressum" className={menuLinkClass(page === "impressum")}>
              Impressum
            </a>
            <a href="#datenschutz" className={menuLinkClass(page === "datenschutz")}>
              Datenschutz
            </a>
            <div className="my-1 border-t border-gray-100" />
            <a href="#admin" className="block px-4 py-2 text-xs text-gray-400 hover:text-gray-600">
              Admin
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

export function FlohmarktApp() {
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [kategorienFilter, setKategorienFilter] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [hasOwnStand, setHasOwnStand] = useState(false);
  const { favoriteIds, toggleFavorite } = useFavorites();

  const handleStandChange = useCallback((stand: OwnStand | null) => {
    setHasOwnStand(stand !== null);
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

  const filteredStands = stands
    .filter(
      (s) =>
        kategorienFilter.length === 0 || s.kategorien.some((k) => kategorienFilter.includes(k)),
    )
    .filter((s) => !showFavoritesOnly || favoriteIds.has(s.id));

  const initialLoading = loading && stands.length === 0;

  return (
    <div className="flex min-h-screen flex-col">
      {initialLoading && <MascotLoading />}
      <Header page={page} hasOwnStand={hasOwnStand} />
      <InstallPrompt />

      {page === "faq" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <BackButton />
          <Faq />
        </main>
      ) : page === "impressum" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <BackButton />
          <Impressum />
        </main>
      ) : page === "datenschutz" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <BackButton />
          <Datenschutz />
        </main>
      ) : page === "stand-anmelden" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <BackButton />
          <StandForm
            onSuccess={() => {
              loadStands();
              window.location.hash = "";
            }}
          />
        </main>
      ) : page === "mein-stand" ? null : (
        <main className="flex-1">
          {/* Karte als Startseite – volle Breite, prominent */}
          <div className="relative w-full" style={{ height: "min(65vh, 520px)" }}>
            <MapOrList
              kategorienFilter={kategorienFilter}
              showFavoritesOnly={showFavoritesOnly}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              stands={filteredStands}
              loading={loading}
            />
            {/* Kategorie-Filter-Overlay - horizontal scrollbar statt Umbruch,
                da 18 Kategorien sonst mehrzeilig die Karte zu stark verdecken
                (v.a. mobil). */}
            <div className="absolute bottom-3 left-0 right-0 z-10 px-4">
              <div
                style={{ scrollbarWidth: "none" }}
                className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white/90 px-3 py-2 shadow-md backdrop-blur-sm [&::-webkit-scrollbar]:hidden"
              >
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  className={`shrink-0 rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${
                    showFavoritesOnly
                      ? "border-amber-400 bg-amber-400 text-white"
                      : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
                  }`}
                >
                  ★ Favoriten
                </button>
                <div className="mx-0.5 h-4 w-px shrink-0 self-center bg-gray-200" />
                {KATEGORIEN.map((k) => {
                  const active = kategorienFilter.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleFilter(k)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-[#009a00] bg-[#009a00] text-white"
                          : "border-gray-300 bg-white text-gray-600 hover:border-[#009a00] hover:text-[#009a00]"
                      }`}
                    >
                      {k}
                    </button>
                  );
                })}
                {(kategorienFilter.length > 0 || showFavoritesOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setKategorienFilter([]);
                      setShowFavoritesOnly(false);
                    }}
                    className="shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-400 hover:text-gray-600"
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
                      {kategorienFilter.length > 0 || showFavoritesOnly
                        ? ` von ${stands.length}`
                        : ""}
                      )
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly((v) => !v)}
                    className={`rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                      showFavoritesOnly
                        ? "border-amber-400 bg-amber-400 text-white"
                        : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
                    }`}
                  >
                    ★ Favoriten
                  </button>
                  <div className="mx-0.5 h-4 w-px self-center bg-gray-200" />
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
                  {(kategorienFilter.length > 0 || showFavoritesOnly) && (
                    <button
                      type="button"
                      onClick={() => {
                        setKategorienFilter([]);
                        setShowFavoritesOnly(false);
                      }}
                      className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <StandListe
                stands={filteredStands}
                loading={loading}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
              />
            </section>
          </div>
        </main>
      )}

      {/* Immer gemountet (nicht nur auf der "mein-stand"-Seite), damit eine
          vorhandene Session sofort erkannt wird - sonst würde der Menüpunkt
          "Eigenen Stand anmelden" kurz aufblitzen, bevor die Session geladen
          ist. Sichtbar nur, wenn die Seite tatsächlich aktiv ist. */}
      <main
        className="mx-auto w-full max-w-2xl flex-1 px-4 py-10"
        style={{ display: page === "mein-stand" ? "block" : "none" }}
      >
        <BackButton />
        <MeinStand onCancelled={loadStands} onStandChange={handleStandChange} />
      </main>

      <Footer />
    </div>
  );
}
