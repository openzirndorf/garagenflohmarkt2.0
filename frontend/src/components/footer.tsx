export const PORTAL_URL = "https://portal.openzirndorf.de/";

// TODO: sobald der Veranstalter feststeht, hier den echten Vereinsnamen
// (und optional eine URL) statt des Platzhalters eintragen.
const VERANSTALTER = "wird ergänzt";

const UNTERSTUETZER = ["CSU", "Die Linke", "Freie Wähler", "Grüne", "SPD", "Volt", "ZBG"];

const linkStyle = { color: "#009a00" } as const;

export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-white px-4 py-6 text-center text-xs text-gray-500">
      <p className="mb-1">
        Veranstalter: <strong>{VERANSTALTER}</strong>
        {" · "}Technische Umsetzung:{" "}
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={linkStyle}
        >
          OpenZirndorf
        </a>
      </p>
      <p className="mb-3 text-gray-400">Unterstützt von {UNTERSTUETZER.join(", ")}</p>
      <div className="flex flex-wrap justify-center gap-4">
        <a
          href="mailto:fabian@openzirndorf.de"
          className="font-semibold hover:underline"
          style={linkStyle}
        >
          Kontakt
        </a>
        <a href="#impressum" className="font-semibold hover:underline" style={linkStyle}>
          Impressum
        </a>
        <a href="#datenschutz" className="font-semibold hover:underline" style={linkStyle}>
          Datenschutz
        </a>
        <a href="#faq" className="font-semibold hover:underline" style={linkStyle}>
          FAQ
        </a>
      </div>
    </footer>
  );
}
