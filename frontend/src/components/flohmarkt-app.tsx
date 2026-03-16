import { useCallback, useEffect, useState } from "react";
import { fetchStands } from "../api";
import type { Stand } from "../types";
import { Faq } from "./faq";
import { FlohmarktMap } from "./flohmarkt-map";
import { MeinStand } from "./mein-stand";
import { KATEGORIEN } from "./stand-form";
import { StandForm } from "./stand-form";
import { StandListe } from "./stand-liste";

const PORTAL_URL = "https://openzirndorf.github.io/openzirndorf-portal/";
const IMPRESSUM_URL = "https://openzirndorf.github.io/openzirndorf-portal/#impressum";

function OzLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="#009a00" />
      <text
        x="16"
        y="23"
        fontSize="18"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontWeight="bold"
        fill="white"
      >
        OZ
      </text>
    </svg>
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
          Garagenflohmarkt <span className="text-[--oz-green]">Zirndorf</span>
        </span>
      </button>
      <a href={PORTAL_URL} className="hidden text-sm text-gray-400 hover:text-gray-600 sm:block">
        OpenZirndorf ↗
      </a>
      <a
        href="#faq"
        className={`text-sm transition-colors ${page === "faq" ? "font-semibold text-[--oz-green]" : "text-gray-500 hover:text-gray-700"}`}
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
    <footer className="mt-16 flex justify-center gap-4 border-t py-8 text-sm text-gray-400">
      <a href={PORTAL_URL} className="transition-colors hover:text-[--oz-green]">
        Ein OpenZirndorf-Projekt
      </a>
      <span aria-hidden="true">·</span>
      <a href="#faq" className="transition-colors hover:text-[--oz-green]">
        Regeln & FAQ
      </a>
      <span aria-hidden="true">·</span>
      <a
        href={IMPRESSUM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-[--oz-green]"
      >
        Impressum
      </a>
    </footer>
  );
}

export function FlohmarktApp() {
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => (window.location.hash === "#faq" ? "faq" : "main"));
  const [kategorienFilter, setKategorienFilter] = useState<string[]>([]);

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

  return (
    <div className="flex min-h-screen flex-col">
      <Header page={page} />

      {page === "faq" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <button
            type="button"
            onClick={() => {
              window.location.hash = "";
            }}
            className="mb-6 text-sm text-[--oz-green] hover:underline"
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
                          ? "border-[--oz-green] bg-[--oz-green] text-white"
                          : "border-gray-300 bg-white text-gray-600 hover:border-[--oz-green] hover:text-[--oz-green]"
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

          <div className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-8">
            <MeinStand onCancelled={loadStands} />

            <section aria-label="Stand anmelden">
              <StandForm onSuccess={loadStands} />
            </section>

            <section aria-label="Alle Stände">
              <h2
                style={{ fontFamily: "var(--oz-font-heading)" }}
                className="mb-4 flex items-center gap-2 text-xl font-bold"
              >
                Angemeldete Stände
                {!loading && stands.length > 0 && (
                  <span className="text-sm font-normal text-gray-400">
                    ({filteredStands.length}
                    {kategorienFilter.length > 0 ? ` von ${stands.length}` : ""})
                  </span>
                )}
              </h2>
              <StandListe stands={filteredStands} loading={loading} />
            </section>
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}
