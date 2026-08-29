function goHome() {
  window.location.hash = "";
}

// TODO: Vereinsname/-adresse ergänzen, sobald der Veranstalter feststeht
// (siehe auch footer.tsx) - Art. 26 DSGVO verlangt, beide gemeinsam
// Verantwortlichen und den Kern ihrer Vereinbarung zu nennen.
const VERANSTALTER = "wird ergänzt";

export function Datenschutz() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <button
        type="button"
        onClick={goHome}
        className="inline-block w-fit text-sm text-[#009a00] hover:underline"
      >
        ← Zurück
      </button>

      <h1 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-3xl font-extrabold">
        Datenschutzerklärung
      </h1>

      <div className="flex flex-col gap-5 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">
            1. Gemeinsam Verantwortliche (Art. 26 DSGVO)
          </h2>
          <p>
            OpenZirndorf (Fabian Hartmann, Erich-Kästner-Weg 33, 90513 Zirndorf,{" "}
            <a href="mailto:team@openzirndorf.de" className="underline">
              team@openzirndorf.de
            </a>
            ) und der Veranstalter <strong>{VERANSTALTER}</strong> sind gemeinsam Verantwortliche im
            Sinne von Art. 26 DSGVO. OpenZirndorf betreibt die technische Infrastruktur (Server,
            Datenbank, Versand der Zugangscodes); der Veranstalter organisiert den Garagenflohmarkt
            und entscheidet über die Freigabe eingereichter Stände. Bei Fragen zum Datenschutz
            erreicht ihr uns über die oben genannte E-Mail-Adresse.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">2. Welche Daten wir erheben</h2>
          <p>
            Bei der Anmeldung eines Standes werden Adresse, eine optionale Beschreibung, Kategorien
            sowie deine E-Mail-Adresse gespeichert. Es gibt bewusst kein Namensfeld - ein echter
            Name kann technisch gar nicht erst ins System gelangen. Stattdessen vergeben wir
            automatisch eine Kennung (z.&nbsp;B. „Gscheide Kellerkönig"), unter der du auf der Karte
            erscheinst.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">
            3. Öffentlich sichtbar auf der Karte
          </h2>
          <p>
            Nur folgende Angaben sind öffentlich auf der Karte und in der Liste sichtbar: deine
            automatisch vergebene Kennung, Straße und Hausnummer sowie die Beschreibung. Deine
            E-Mail-Adresse und dein echter Name (den wir ohnehin nicht erfassen) erreichen die
            öffentliche Ausgabe unter keinen Umständen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">
            4. Zugangscode statt Konto/Passwort
          </h2>
          <p>
            Statt eines Kontos mit Passwort bekommst du einen Zugangscode per E-Mail, den du unter
            „Mein Stand" eingibst (bewusst kein anklickbarer Link - als installierte App öffnet ein
            Mail-Link diese nicht zuverlässig). Der Code ist einmalig verwendbar und befristet
            gültig; nach der Eingabe erhältst du eine zeitlich begrenzte Sitzung, mit der du deinen
            Stand bearbeiten oder vollständig löschen kannst. Wir speichern nur einen
            kryptografischen Hash dieses Codes, nie den Code selbst im Klartext. Rechtsgrundlage ist
            die Erfüllung des Nutzungsvertrags zur Standanmeldung (Art. 6 Abs. 1 lit. b DSGVO).
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">5. Speicherdauer und Löschung</h2>
          <p>
            Die Karte geht am 7. Oktober 2026 offline; sämtliche Anmeldedaten (Datenbank, generierte
            Kartendaten, Backups) werden automatisiert zu diesem Termin gelöscht - durch einen
            geplanten Job, nicht durch eine manuelle Erinnerung. Du kannst deinen Stand auch selbst
            jederzeit vorher vollständig löschen: unter{" "}
            <a href="#mein-stand" className="underline">
              „Mein Stand"
            </a>{" "}
            mit deinem Zugangscode einloggen und „Stand und Daten löschen" wählen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">6. Kartenkacheln</h2>
          <p>
            Die Kartendarstellung lädt Kartenkacheln von OpenFreeMap (openfreemap.org). Dabei wird,
            wie bei jedem Webseitenaufruf, deine IP-Adresse an diesen Dienst übertragen; OpenFreeMap
            ist ein nichtkommerzielles Projekt, das nach eigenen Angaben kein Tracking einsetzt.
            Weitere Inhalte von Drittservern werden nicht geladen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">7. Hosting und Logs</h2>
          <p>
            Die App läuft auf Servern von Scaleway innerhalb der EU. Unsere Anwendung protokolliert
            bewusst keine personenbezogenen Daten oder Zugangscodes in ihren Logs. Es werden keine
            Cookies gesetzt und keine Analyse- oder Trackingdienste eingebunden.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">8. Deine Rechte</h2>
          <p>
            Dir stehen die Betroffenenrechte nach Art. 15–21 DSGVO zu (Auskunft, Berichtigung,
            Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit). Eine vollständige Auskunft
            über deine gespeicherten Daten kannst du dir jederzeit selbst über deinen
            Bearbeitungsbereich („Meine Daten herunterladen") herunterladen. Zuständige
            Aufsichtsbehörde ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Ansbach.
          </p>
        </section>
      </div>

      <p className="mt-2 text-sm text-gray-500">entwickelt mit ❤️ in Zirndorf</p>

      {/* Bewusst hier statt prominent im Hamburger-Menü - innerhalb einer
          installierten PWA gibt es keine Adresszeile, iOS kennt außerdem
          keine Manifest-Shortcuts (siehe vite.config.ts), daher bleibt
          irgendein Weg zu #admin innerhalb der App nötig, nur eben
          zurückhaltend platziert. */}
      <a href="#admin" className="text-xs text-gray-300 hover:text-gray-400">
        Admin
      </a>
    </div>
  );
}
