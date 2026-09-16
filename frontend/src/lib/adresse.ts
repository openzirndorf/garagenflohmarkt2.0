// Der Flohmarkt findet ausschließlich in Zirndorf statt (eine einzige PLZ
// fürs ganze Gemeindegebiet inkl. Außenorte, serverseitig durchgesetzt -
// siehe _ZIRNDORF_POSTCODE in app/routes/stands.py). PLZ/Ort brauchen
// deshalb keine echte Auswahl/Vorschlagsliste, sondern sind im Formular
// fest vorausgefüllt - nur Straße und Hausnummer sind echte Eingaben.
export const ZIRNDORF_PLZ = "90513";
export const ZIRNDORF_ORT = "Zirndorf";

// Muss mit _format_adresse in app/geocode.py übereinstimmen, damit die
// clientseitig zusammengesetzte Adresse exakt so aussieht wie die vom
// Server nach erfolgreichem Geocoding zurückgegebene - sonst würde sich
// die Anzeige nach dem ersten Speichern unerwartet ändern.
export function composeAdresse(strasse: string, hausnummer: string): string {
  return `${strasse.trim()} ${hausnummer.trim()}, ${ZIRNDORF_PLZ} ${ZIRNDORF_ORT}`;
}

// Zerlegt eine bereits einheitlich formatierte Adresse ("Straße
// Hausnummer, 90513 Zirndorf", optional mit "(Ortsteil)"-Suffix) zurück in
// Straße und Hausnummer, fürs Vorausfüllen des Bearbeiten-Formulars. Gibt
// null zurück, wenn die Adresse (z.B. eine alte, frei getippte Eingabe vor
// dieser Änderung) nicht in dieses Muster passt - der Aufrufer zeigt dann
// die Rohadresse als Fallback in einem Freitextfeld.
const ADRESSE_PATTERN = /^(.+?)\s+(\S+),\s*90513\s+Zirndorf(?:\s*\([^)]+\))?$/;

export function splitAdresse(adresse: string): { strasse: string; hausnummer: string } | null {
  const match = adresse.match(ADRESSE_PATTERN);
  if (!match) return null;
  return { strasse: match[1].trim(), hausnummer: match[2].trim() };
}
