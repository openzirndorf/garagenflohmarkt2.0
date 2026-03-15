import { useCallback, useEffect, useState } from "react";
import { fetchStands } from "../api";
import type { Stand } from "../types";
import { FlohmarktMap } from "./flohmarkt-map";
import { MeinStand } from "./mein-stand";
import { StandForm } from "./stand-form";
import { StandListe } from "./stand-liste";

export function FlohmarktApp() {
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      <h1 className="text-3xl font-bold">Garagenflohmarkt Zirndorf</h1>

      <section aria-label="Karte der Stände">
        <FlohmarktMap />
      </section>

      <MeinStand onCancelled={loadStands} />

      <section aria-label="Stand anmelden">
        <StandForm onSuccess={loadStands} />
      </section>

      <section aria-label="Alle Stände">
        <h2 className="text-xl font-semibold mb-4">Angemeldete Stände</h2>
        <StandListe stands={stands} loading={loading} />
      </section>
    </main>
  );
}
