import type { ReactNode } from "react";
import { PORTAL_URL } from "./footer";

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
      {children}
    </h2>
  );
}

function QA({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="border-l-4 border-[#009a00] pl-4">
      <p className="font-semibold text-gray-800">{q}</p>
      {/* div statt p, damit Antworten mit mehreren Absätzen (z.B. die
          PayPal-/Wero-Anleitung) sauber eigene <p>s verschachteln können. */}
      <div className="mt-1 flex flex-col gap-2 text-gray-600 text-sm">{children}</div>
    </div>
  );
}

export function Faq() {
  return (
    <div className="flex flex-col gap-8 py-4">
      <div>
        <h1 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-3xl font-extrabold">
          Teilnahmebedingungen & FAQ
        </h1>
        <p className="mt-2 text-gray-500">
          Bitte lies diese Hinweise sorgfältig durch, bevor du deinen Stand anmeldest.
        </p>
      </div>

      {/* Allgemein - betrifft Standbetreiber wie Besucher gleichermaßen */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Allgemein</SectionHeading>
        <QA q="Wie funktioniert die App?">
          Auf der Startseite zeigen Karte und Liste alle angemeldeten Stände - beide folgen
          derselben Suche und denselben Filtern dazwischen. Tippe auf einen Pin oder einen Eintrag
          für Details wie Kategorien, Zahlungsarten und einen „Navigieren"-Button. Mit „★ Favoriten"
          merkst du dir Stände und findest sie über den Filter wieder. Willst du selbst mitmachen,
          meldest du über „📍 Eigenen Stand anmelden" (oben im Menü oder im grünen Banner) deinen
          eigenen Stand an.
        </QA>
        <QA q="Wer steckt hinter OpenZirndorf?">
          OpenZirndorf ist eine parteiübergreifende, ehrenamtliche Initiative aus mehreren im
          Zirndorfer Stadtrat vertretenen Parteien (siehe Fußzeile) - der Garagenflohmarkt ist eines
          von mehreren Projekten für die Stadt. Mehr über die Initiative und wie du sie unterstützen
          kannst, z.&nbsp;B. als Fördermitglied, gibt's auf{" "}
          <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer" className="underline">
            openzirndorf.de
          </a>
          .
        </QA>
        <QA q="Kann ich die Seite als App installieren?">
          Ja - auf Android/Chrome zeigt ein Banner oben eine „Installieren"-Schaltfläche. Auf dem
          iPhone/iPad geht es über Safari: Teilen-Symbol antippen, dann „Zum Home-Bildschirm".
          Danach startet die App wie eine normale App vom Homescreen, schneller und ohne
          Adressleiste.
        </QA>
        <p className="text-gray-700">
          Jeder Teilnehmer trägt <strong>selbst die volle Verantwortung</strong> für seinen Stand
          bzw. seinen Einkauf. OpenZirndorf vermittelt nur die Standanmeldung und Kartendarstellung
          (siehe{" "}
          <a href="#datenschutz" className="underline">
            Datenschutz
          </a>
          ), ist an keinem Verkauf, keiner Zahlung und keiner Vor-Ort-Absprache beteiligt und
          übernimmt keine Haftung für Schäden, Vorfälle, Betrug oder Streitigkeiten zwischen
          Standbetreiber und Besucher. Versicherungstechnische Fragen kläre bitte direkt mit dem
          Eigentümer oder der Hausverwaltung des Grundstücks. Wir behalten uns vor, Einträge ohne
          Angabe von Gründen zu bearbeiten oder zu löschen, z.&nbsp;B. bei Verstößen gegen diese
          Bedingungen oder gemeldeten Problemen.
        </p>
      </section>

      {/* Für Standbetreiber */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Für Standbetreiber</SectionHeading>

        <div className="flex flex-col gap-3">
          <p className="font-semibold text-gray-800">Wer darf mitmachen?</p>
          <ul className="flex flex-col gap-2 text-gray-700">
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                <strong>Nur Privatpersonen</strong> – gewerbliche Anbieter sind nicht zugelassen.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                <strong>Nur innerhalb Zirndorfs</strong> – dein Stand muss sich im Stadtgebiet
                befinden.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                <strong>Nur gebrauchte oder selbstgemachte Dinge</strong> – neue Produkte,
                gewerblicher Handel oder gewerbliche Artikel sind verboten.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold text-gray-800">Was ist verboten?</p>
          <ul className="flex flex-col gap-2 text-gray-700">
            {[
              "Gewerblicher Handel, neue Produkte und gewerbliche Artikel",
              "Lebensmittel und Getränke, inkl. Alkohol",
              "Waffen jeglicher Art",
              "Gefährliche Stoffe und offene Flammen",
              "Fahrzeuge (außer Spielzeug)",
              "Politisches Material",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-red-500 font-bold shrink-0">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold text-gray-800">Aufstellung, Erlaubnis & Sicherheit</p>
          <ul className="flex flex-col gap-2 text-gray-700">
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                Dein Stand muss sich <strong>ausschließlich auf deinem eigenen Privatgrund</strong>{" "}
                befinden – Garten, Stellplatz oder Garage, nicht auf Gehwegen oder öffentlichen
                Flächen.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                Bist du <strong>nicht Eigentümer</strong> des Grundstücks? Hol dir vorher die
                Erlaubnis von Hausverwaltung oder Eigentümer.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                <strong>Wege freihalten</strong> – Gehwege und Zufahrten dürfen nicht blockiert
                werden.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                <strong>Stand gut sichern</strong>, damit z.B. bei Wind nichts umkippt oder
                wegfliegt.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#009a00] font-bold shrink-0">✓</span>
              <span>
                Markiere deinen Stand mit <strong>mindestens 3 bunten Luftballons</strong>, damit
                Besucher ihn leicht finden.
              </span>
            </li>
          </ul>
        </div>

        <QA q="Bis wann kann ich meinen Stand anmelden?">
          Anmeldungen sind bis zum Veranstaltungstag möglich, solange die Seite aktiv ist.
        </QA>
        <QA q="Kostet die Teilnahme etwas?">
          Nein, die Teilnahme ist kostenlos. Wenn du OpenZirndorf trotzdem unterstützen möchtest,
          gibt es die Möglichkeit einer Fördermitgliedschaft - mehr dazu auf{" "}
          <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer" className="underline">
            openzirndorf.de
          </a>
          .
        </QA>
        <QA q="Warum muss ich meine E-Mail bestätigen?">
          Die E-Mail-Bestätigung verhindert Spam und stellt sicher, dass du deinen Stand später
          verwalten kannst.
        </QA>
        <QA q="Kann ich meinen Stand nach der Anmeldung noch ändern?">
          Ja – gib deinen Zugangscode aus der Bestätigungsmail unter „Mein Stand" ein (oder fordere
          dir dort jederzeit einen neuen an), dann kannst du Adresse, Beschreibung, Kategorien und
          Zahlungsarten jederzeit bearbeiten.
        </QA>
        <QA q="Was passiert, wenn mein Stand nicht auf der Karte erscheint?">
          Prüfe, ob du den Bestätigungscode in der Mail unter „Mein Stand" eingegeben hast. Ohne
          Bestätigung bleibt dein Stand unsichtbar. Auch muss die eingetragene Adresse in Zirndorf
          liegen, damit sie auf der Karte angezeigt werden kann.
        </QA>
        <QA q="Wie richte ich einen PayPal-/Wero-QR-Code für meinen Stand ein?">
          <p>
            <strong>PayPal:</strong> Lege dir (falls noch nicht vorhanden) unter{" "}
            <a
              href="https://www.paypal.com/paypalme"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              paypal.me
            </a>{" "}
            einen eigenen Zahlungslink an - die PayPal-App zeigt dazu direkt einen passenden QR-Code
            an. Den kannst du ausdrucken und gut sichtbar an deinem Stand auslegen, oder einfach
            dein Handy mit dem QR-Code am Stand stehen lassen.
          </p>
          <p>
            <strong>Wero:</strong> Die Wero-Funktion in deiner Banking-App (falls deine Bank Wero
            unterstützt) erzeugt genauso einen eigenen Zahlungs-QR-Code - auch den kannst du
            ausdrucken und auslegen oder direkt vom Handy anzeigen lassen.
          </p>
          <p>
            Richte beides direkt in der jeweiligen offiziellen App ein - eine Schritt-für-Schritt-
            Anleitung können wir hier nicht geben, da sich das je nach Bank/App-Version
            unterscheidet.
          </p>
          <p>
            <strong>Wichtig:</strong> Diese Seite hat mit PayPal oder Wero nichts zu tun, betreibt
            selbst keine Zahlungsabwicklung und ist an keiner Zahlung beteiligt. Wir übernehmen
            keine Verantwortung für Zahlungen zwischen dir und deinen Käufer*innen - weder für
            Betrug noch für technische Probleme bei PayPal, Wero oder deiner Bank. Prüfe eingehende
            Zahlungen immer selbst, bevor du Ware aushändigst.
          </p>
        </QA>
      </section>

      {/* Für Besucher */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Für Besucher</SectionHeading>
        <QA q="Wie bezahle ich vor Ort? Was ist Wero?">
          Standbetreiber können bei der Anmeldung angeben, ob sie neben Barzahlung auch PayPal
          und/oder Wero akzeptieren - erkennbar am 💳/💵-Symbol auf der Karte und in der Liste, und
          über die Filterleiste gezielt auswählbar. Wero ist eine neue, europaweite Bezahl-App (von
          einem Zusammenschluss europäischer Banken), mit der du direkt von deinem Bankkonto aus
          bezahlst, ähnlich unkompliziert wie PayPal - in den App Stores unter „Wero" zu finden. Die
          Zahlung selbst läuft in jedem Fall direkt zwischen dir und dem Standbetreiber vor Ort;
          diese Seite ist daran nicht beteiligt und wickelt keine Zahlungen ab.
        </QA>
      </section>
    </div>
  );
}
