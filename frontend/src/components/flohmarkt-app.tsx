import { useCallback, useEffect, useState } from "react";
import { fetchStands } from "../api";
import type { Stand } from "../types";
import { FlohmarktMap } from "./flohmarkt-map";
import { Impressum } from "./impressum";
import { MeinStand } from "./mein-stand";
import { StandForm } from "./stand-form";
import { StandListe } from "./stand-liste";

const PORTAL_URL = "https://openzirndorf.github.io/openzirndorf-portal/";

function Header({ page }: { page: string }) {
  const navCls =
    page === "impressum" ? "font-medium text-gray-900" : "text-gray-500 hover:text-gray-700";
  const goHome = () => {
    window.location.hash = "";
  };
  return (
    <header
      style={{ height: "var(--oz-header-height)" }}
      className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100 bg-white px-4"
    >
      <button type="button" onClick={goHome} className="mr-auto flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">
          🏘
        </span>
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
      <a href="#impressum" className={`text-sm transition-colors ${navCls}`}>
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
      <a href="#impressum" className="transition-colors hover:text-[--oz-green]">
        Impressum
      </a>
    </footer>
  );
}

export function FlohmarktApp() {
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() =>
    window.location.hash === "#impressum" ? "impressum" : "main",
  );

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
    const onHash = () => setPage(window.location.hash === "#impressum" ? "impressum" : "main");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header page={page} />

      {page === "impressum" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <Impressum />
        </main>
      ) : (
        <main className="flex-1">
          <div className="border-b border-green-100 bg-[--oz-green-light] px-4 py-10">
            <div className="mx-auto max-w-2xl">
              <h1
                style={{ fontFamily: "var(--oz-font-heading)" }}
                className="mb-2 text-4xl font-extrabold leading-tight text-[--oz-green-dark]"
              >
                Garagenflohmarkt Zirndorf
              </h1>
              <p className="text-lg text-gray-600">
                Melde deinen Stand an und finde alle Verkäufer auf der Karte.
              </p>
            </div>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-8">
            <section aria-label="Karte der Stände">
              <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-md">
                <FlohmarktMap />
              </div>
            </section>

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
                  <span className="text-sm font-normal text-gray-400">({stands.length})</span>
                )}
              </h2>
              <StandListe stands={stands} loading={loading} />
            </section>
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}
