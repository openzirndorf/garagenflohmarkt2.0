import type { Stand } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui";

interface Props {
  stands: Stand[];
  loading: boolean;
}

export function StandListe({ stands, loading }: Props) {
  if (loading) {
    return (
      <p aria-live="polite" className="text-muted-foreground text-sm">
        Stände werden geladen…
      </p>
    );
  }

  if (!stands.length) {
    return <p className="text-muted-foreground text-sm">Noch keine Stände angemeldet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {stands.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle className="text-base">{s.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{s.adresse}</p>
            {s.beschreibung && <p className="text-sm mt-1">{s.beschreibung}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
