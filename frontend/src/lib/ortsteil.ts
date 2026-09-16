// Ortsteile, für die app/geocode.py automatisch den Zusatz "(Ortsteil)" an
// die formatierte Adresse anhängt (siehe dortige _ORTSTEILE-Liste, MUSS mit
// dieser Liste übereinstimmen). Rein clientseitig aus dem ohnehin schon
// geladenen Adresstext extrahiert statt einer eigenen Datenbank-Spalte/
// eines eigenen API-Felds - die Information steckt dort schon vollständig
// drin, ein Duplikat wäre nur eine weitere Stelle, die man synchron halten
// müsste.
export const ORTSTEILE = [
  "Weiherhof",
  "Banderbach",
  "Bronnamberg",
  "Wintersdorf",
  "Lind",
  "Anwanden",
  "Weinzierlein",
] as const;

const ORTSTEIL_PATTERN = new RegExp(`\\((${ORTSTEILE.join("|")})\\)$`);

export function extractOrtsteil(adresse: string): string | null {
  return adresse.match(ORTSTEIL_PATTERN)?.[1] ?? null;
}
