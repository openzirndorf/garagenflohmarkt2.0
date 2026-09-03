import { useCallback, useEffect, useRef, useState } from "react";
import { type OwnStand, fetchStands } from "../api";
import { useFavorites } from "../lib/favorites";
import { appShareOptions } from "../lib/share";
import type { Stand } from "../types";
import { Datenschutz } from "./datenschutz";
import { Faq } from "./faq";
import { Footer } from "./footer";
import { Impressum } from "./impressum";
import { InstallPrompt } from "./install-prompt";
import { MapOrList } from "./map-or-list";
import { MeinStand } from "./mein-stand";
import { OnboardingHint } from "./onboarding-hint";
import { ShareButton } from "./share-button";
import { KATEGORIEN, ZAHLUNGSARTEN, ZAHLUNGSART_ICON } from "./stand-form";
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
            {/* Bewusst ein <button> statt <a href="#">: ist die Startseite
                schon aktiv, ändert sich der Hash nicht, der hashchange-
                Listener oben würde das Menü dann nicht automatisch
                schließen - hier daher direkt per onClick. */}
            <button
              type="button"
              onClick={() => {
                goHome();
                setMenuOpen(false);
              }}
              className={`w-full text-left ${menuLinkClass(page === "main")}`}
            >
              🏠 Startseite
            </button>
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
            {/* Bewusst klein/unauffällig statt wie die Einträge oben - kein
                Nutzer-Feature, aber auch kein Sicherheitsrisiko, hier zu
                verlinken: der eigentliche Zugang bleibt durch E-Mail+Code
                gegen das Admin-Roster geschützt (siehe app/routes/admins.py). */}
            <a
              href="#admin"
              className="block px-4 py-1.5 text-xs text-gray-400 hover:text-gray-600"
            >
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
  const [zahlungsartenFilter, setZahlungsartenFilter] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [hasOwnStand, setHasOwnStand] = useState(false);
  // Zeigt unter "Mein Stand" einen Hinweis, direkt nach der Einreichung
  // dorthin geleitet zu werden (siehe StandForm onSuccess unten) - sonst
  // landete man nach dem Absenden zurück auf der Startseite, ohne zu
  // merken, dass noch ein per Mail verschickter Code eingegeben werden muss.
  const [justRegistered, setJustRegistered] = useState(false);
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

  // Schließt das Filter-Panel bei Klick außerhalb - genau wie das
  // Hamburger-Menü (siehe Header oben). War bisher inkonsistent: das Menü
  // schließt sich so, das Filter-Panel blieb offen stehen.
  useEffect(() => {
    if (!filterPanelOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterPanelOpen]);

  // Deep-Link zum Teilen des eigenen Stands (siehe lib/share.ts,
  // standShareOptions()): "#suche=<nickname>" befüllt beim Start einfach die
  // schon vorhandene Freitextsuche, statt eine eigene Karte-zentrieren-und-
  // Popup-öffnen-Logik zu bauen - wer den Link öffnet, sieht Karte und Liste
  // direkt auf den einen Stand gefiltert.
  useEffect(() => {
    const match = window.location.hash.match(/^#suche=(.+)$/);
    if (match) setSearchInput(decodeURIComponent(match[1]));
  }, []);

  const toggleFilter = (k: string) => {
    setKategorienFilter((prev) => (prev.includes(k) ? prev.filter((c) => c !== k) : [...prev, k]));
  };

  const toggleZahlungsartFilter = (z: string) => {
    setZahlungsartenFilter((prev) =>
      prev.includes(z) ? prev.filter((c) => c !== z) : [...prev, z],
    );
  };

  // Auch von StandListe aufgerufen (siehe deren "Keine Treffer"-Zustand,
  // unterscheidet dort von "wirklich noch keine Stände angemeldet") -
  // deshalb als eigene Funktion statt inline im Filter-Panel-Button unten.
  const resetFilters = () => {
    setKategorienFilter([]);
    setZahlungsartenFilter([]);
    setShowFavoritesOnly(false);
    setSearchInput("");
  };

  // Freitextsuche statt immer neuer Kategorie-Pillen - findet auch Dinge,
  // für die es keine eigene Kategorie gibt (z.B. "Kinderwagen" nur in der
  // Beschreibung), ohne die Filterleiste weiter zu füllen.
  const searchQuery = searchInput.trim().toLowerCase();

  // Nur die Pillen-Filter (Favoriten/Zahlungsart/Kategorie) zählen für das
  // Badge am "Filter"-Button - die Suche hat ihr eigenes, immer sichtbares
  // Feld und braucht keinen Zähler.
  const activeFilterCount =
    kategorienFilter.length + zahlungsartenFilter.length + (showFavoritesOnly ? 1 : 0);

  const hasActiveFilter = activeFilterCount > 0 || searchQuery !== "";

  const matchesSearch = (s: Stand) =>
    searchQuery === "" ||
    s.nickname.toLowerCase().includes(searchQuery) ||
    s.adresse.toLowerCase().includes(searchQuery) ||
    (s.beschreibung ?? "").toLowerCase().includes(searchQuery) ||
    s.kategorien.some((k) => k.toLowerCase().includes(searchQuery)) ||
    s.zahlungsarten.some((z) => z.toLowerCase().includes(searchQuery));

  const filteredStands = stands
    .filter(
      (s) =>
        kategorienFilter.length === 0 || s.kategorien.some((k) => kategorienFilter.includes(k)),
    )
    .filter(
      (s) =>
        zahlungsartenFilter.length === 0 ||
        s.zahlungsarten.some((z) => zahlungsartenFilter.includes(z)),
    )
    .filter((s) => !showFavoritesOnly || favoriteIds.has(s.id))
    .filter(matchesSearch);

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
              setJustRegistered(true);
              window.location.hash = "mein-stand";
            }}
          />
        </main>
      ) : page === "mein-stand" ? null : (
        <main className="flex-1">
          <OnboardingHint />

          {/* Event-Info-Banner - bewusst über der Karte, nicht darunter:
              Datum/Uhrzeit und der Anmelden-Link sind die zwei wichtigsten
              Infos für Erstbesucher und sollen nicht erst nach dem Scrollen
              durch die ganze Karte sichtbar werden. */}
          <div className="border-b border-green-100 bg-green-50 px-4 py-3">
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold text-[#009a00]">
                    Sonntag, 4. Oktober 2026 · 10:00 – 16:00 Uhr
                  </p>
                  {daysUntilEvent() > 0 && (
                    <span className="text-xs text-green-600">in {daysUntilEvent()} Tagen</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={downloadICS}
                    className="text-xs text-green-700 underline-offset-2 hover:underline"
                  >
                    + Kalender
                  </button>
                  <ShareButton options={appShareOptions()} />
                </div>
              </div>
              {/* Bisher nur im Hamburger-Menü versteckt - hier auf jeder
                  Startseiten-Ansicht sichtbar, statt dass Neulinge erst das
                  Menü öffnen müssen, um überhaupt zu finden, wie man
                  mitmacht. */}
              {!hasOwnStand && (
                <a
                  href="#stand-anmelden"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#009a00] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#008400]"
                >
                  📍 Eigenen Stand anmelden
                </a>
              )}
            </div>
          </div>

          {/* Karte als Startseite – volle Breite, prominent, ohne Overlay */}
          <div className="relative mt-3 w-full" style={{ height: "min(65vh, 520px)" }}>
            <MapOrList
              kategorienFilter={kategorienFilter}
              zahlungsartenFilter={zahlungsartenFilter}
              showFavoritesOnly={showFavoritesOnly}
              searchQuery={searchQuery}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              stands={filteredStands}
              loading={loading}
              hasActiveFilter={hasActiveFilter}
              onResetFilters={resetFilters}
            />
          </div>

          {/* Suche + Filter - EIN Kontrollbereich zwischen Karte und Liste
              statt zweier fast identischer Filterleisten (früher: eine
              schwebend auf der Karte, eine nochmal über der Liste). Bewusst
              zwischen beiden statt darüber: steuert sichtbar beide Ansichten
              gleichzeitig (siehe Hinweistext unten), statt nur wie ein Zusatz
              zur Karte davor zu wirken. Filter-Pillen stecken hinter einem
              eigenen "Filter"-Button mit Zähler-Badge statt immer als lange
              Scroll-Reihe sichtbar zu sein - bei 18 Kategorien plus
              Zahlungsart plus Favoriten wirkte das trotz Gruppierung
              unübersichtlich. Im geöffneten Panel sind die drei Filterarten
              mit Mini-Label klar getrennt und brechen um (flex-wrap), statt
              in einer versteckten Scroll-Reihe zu liegen. */}
          <div
            ref={filterPanelRef}
            className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 pt-3"
          >
            <div className="flex gap-2">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Suche, z.B. „Kinderwagen“ oder eine Straße…"
                className="w-full flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setFilterPanelOpen((v) => !v)}
                aria-expanded={filterPanelOpen}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  activeFilterCount > 0
                    ? "border-[#009a00] bg-green-50 text-[#009a00]"
                    : "border-gray-300 bg-white text-gray-600 hover:border-[#009a00] hover:text-[#009a00]"
                }`}
              >
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            </div>

            {filterPanelOpen && (
              <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Favoriten
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly((v) => !v)}
                    className={`rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${
                      showFavoritesOnly
                        ? "border-amber-400 bg-amber-400 text-white"
                        : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
                    }`}
                  >
                    ★ Favoriten
                  </button>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Zahlungsart
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ZAHLUNGSARTEN.map((z) => {
                      const active = zahlungsartenFilter.includes(z);
                      return (
                        <button
                          key={z}
                          type="button"
                          onClick={() => toggleZahlungsartFilter(z)}
                          className={`rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${
                            active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-blue-300 bg-blue-50 text-blue-700 hover:border-blue-600 hover:bg-blue-100"
                          }`}
                        >
                          {ZAHLUNGSART_ICON[z] ?? "💳"} {z}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Kategorie
                  </p>
                  <div className="flex flex-wrap gap-1.5">
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
                  </div>
                </div>

                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="self-start text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
                  >
                    ✕ Alle Filter zurücksetzen
                  </button>
                )}
              </div>
            )}

            {/* Explizit statt implizit lassen, damit sofort klar ist, dass ein
                einziger Satz Filter beide Ansichten steuert. */}
            <p className="px-1 text-xs text-gray-400">
              🗺️ Karte &amp; 📋 Liste folgen derselben Suche und denselben Filtern.
            </p>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
            <section aria-label="Alle Stände">
              <h2
                style={{ fontFamily: "var(--oz-font-heading)" }}
                className="mb-4 flex items-center gap-2 text-xl font-bold"
              >
                Angemeldete Stände
                {!loading && stands.length > 0 && (
                  <span className="text-sm font-normal text-gray-400">
                    ({filteredStands.length}
                    {hasActiveFilter ? ` von ${stands.length}` : ""})
                  </span>
                )}
              </h2>
              <StandListe
                stands={filteredStands}
                loading={loading}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                hasActiveFilter={hasActiveFilter}
                onResetFilters={resetFilters}
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
        <MeinStand
          onCancelled={loadStands}
          onStandChange={handleStandChange}
          justRegistered={justRegistered}
        />
      </main>

      <Footer />
    </div>
  );
}
