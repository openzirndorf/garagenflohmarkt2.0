export const PORTAL_URL = "https://openzirndorf.de/";
const SITE_URL = "https://openzirndorf.de/";
const INSTAGRAM_URL = "https://instagram.com/openzirndorf";
const FACEBOOK_URL = "https://facebook.com/openzirndorf";

const UNTERSTUETZER = ["CSU", "Die Linke", "Freie Wähler", "Grüne", "SPD", "Volt", "ZBG"];

const linkStyle = { color: "#009a00" } as const;

export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-white px-4 py-6 text-center text-xs text-gray-500">
      {/* Kein Veranstalter: der Flohmarkt ist keine zentral organisierte
          Veranstaltung, jede*r verkauft eigenverantwortlich auf eigenem
          Privatgrundstück - OpenZirndorf vermittelt nur (siehe Datenschutz
          Abschnitt 1). */}
      <p className="mb-1">
        Eine Vermittlungsplattform von{" "}
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
      {/* Kontakt, Impressum, Datenschutz und FAQ standen hier zusätzlich als
          eigene Link-Zeile - alle vier bleiben über das Hamburger-Menü
          (bzw. innerhalb von Impressum/Datenschutz die Kontakt-Mail)
          weiterhin erreichbar, der Footer wirkte dadurch aber überladen. */}
      <p className="mb-2 text-gray-400">entwickelt mit ❤️ in Zirndorf</p>
      <div className="flex flex-wrap justify-center gap-3 text-gray-400">
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 hover:underline"
        >
          openzirndorf.de
        </a>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 hover:underline"
        >
          Instagram
        </a>
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 hover:underline"
        >
          Facebook
        </a>
      </div>
    </footer>
  );
}
