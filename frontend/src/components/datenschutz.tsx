export function Datenschutz() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-3xl font-extrabold">
        Datenschutzerklärung
      </h1>

      <div className="flex flex-col gap-5 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">
            1. Verantwortlicher (Art. 4 Nr. 7 DSGVO)
          </h2>
          <p>
            OpenZirndorf (i.G.), Erich-Kästner-Weg 33, 90513 Zirndorf,{" "}
            <a href="mailto:team@openzirndorf.de" className="underline">
              team@openzirndorf.de
            </a>{" "}
            (siehe{" "}
            <a href="#impressum" className="underline">
              Impressum
            </a>
            ) ist alleiniger Verantwortlicher. Einen separaten Veranstalter gibt es nicht:
            OpenZirndorf betreibt lediglich eine Vermittlungsplattform, über die jede*r Teilnehmende
            einen eigenen Stand auf dem eigenen Privatgrundstück anmeldet und in eigener
            Verantwortung durchführt - der Garagenflohmarkt ist keine zentral organisierte
            Veranstaltung. Das Projekt wird von mehreren im Stadtrat vertretenen Parteien
            unterstützt (siehe Fußzeile) - diese haben keinerlei Zugriff auf gespeicherte Daten. Bei
            Fragen zum Datenschutz erreicht ihr uns über die oben genannte E-Mail-Adresse.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">2. Zwecke und Rechtsgrundlagen</h2>
          <p>
            Wir verarbeiten Daten ausschließlich, um Standanmeldungen entgegenzunehmen, sie auf der
            Karte darzustellen, und um dir die Verwaltung (Bearbeiten, Löschen) deines eigenen
            Standes zu ermöglichen. Je nach Verarbeitungsschritt gilt eine andere Rechtsgrundlage:
            die Erfüllung des Nutzungsvertrags zur Standanmeldung (Art. 6 Abs. 1 lit. b DSGVO) für
            Zugangscode und Kontaktweg, und deine ausdrückliche Einwilligung (Art. 6 Abs. 1 lit. a
            DSGVO) für die öffentliche Anzeige deiner Adresse - Details dazu in Abschnitt 4. Eine
            automatische Wortfilter-Prüfung auf unzulässige Inhalte läuft bei jeder Einreichung; das
            ersetzt keine inhaltliche Vorab-Prüfung durch einen Menschen, wir können Stände aber
            jederzeit nachträglich bearbeiten, sperren oder löschen (siehe{" "}
            <a href="#faq" className="underline">
              Teilnahmebedingungen
            </a>
            ).
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">3. Welche Daten wir erheben</h2>
          <p>
            Bei der Anmeldung eines Standes werden Adresse, eine optionale Beschreibung, Kategorien
            sowie deine E-Mail-Adresse gespeichert. Es gibt bewusst kein Namensfeld - ein echter
            Name kann technisch gar nicht erst ins System gelangen. Stattdessen vergeben wir intern
            eine automatisch ausgewürfelte Fantasie-Kennung (z.&nbsp;B. „Gscheide Kellerkönig"), die
            aber nirgends öffentlich angezeigt wird - siehe Abschnitt 4. Zusätzlich bestätigst du
            bei der Anmeldung aktiv, dass du mindestens 16 Jahre alt bist (Art. 8 DSGVO).
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">
            4. Öffentlich sichtbar auf der Karte - deine Einwilligung
          </h2>
          <p>
            Nur folgende Angaben sind öffentlich auf der Karte und in der Liste sichtbar: Straße und
            Hausnummer sowie die Beschreibung - dort erscheinst du unter deiner Adresse, nicht unter
            der internen Fantasie-Kennung aus Abschnitt 3. Deine E-Mail-Adresse und dein echter Name
            (den wir ohnehin nicht erfassen) erreichen die öffentliche Ausgabe unter keinen
            Umständen.
          </p>
          <p className="mt-2">
            Weil dabei eine Privatadresse öffentlich sichtbar wird, stützen wir das bewusst nicht
            auf ein berechtigtes Interesse, sondern auf deine ausdrückliche Einwilligung (Art. 6
            Abs. 1 lit. a DSGVO): du bestätigst das aktiv per Checkbox im Anmeldeformular, bevor der
            Stand eingereicht wird. Den Zeitpunkt dieser Einwilligung speichern wir zusammen mit dem
            Stand, damit wir sie im Streitfall nachweisen können (Art. 7 Abs. 1 DSGVO). Du kannst
            die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, indem du deinen Stand
            unter{" "}
            <a href="#mein-stand" className="underline">
              „Mein Stand"
            </a>{" "}
            vollständig löschst - danach verschwindet die Adresse sofort von der Karte.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">
            5. Zugangscode statt Konto/Passwort
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
          <h2 className="mb-1 text-base font-bold text-gray-900">6. Speicherdauer und Löschung</h2>
          <p>
            Die Karte geht am 7. Oktober 2026 offline; sämtliche Anmeldedaten (Datenbank, generierte
            Kartendaten) werden automatisiert zu diesem Termin gelöscht - durch einen täglich
            laufenden, geplanten Job, nicht durch eine manuelle Erinnerung. Automatische
            Datenbank-Backups sind bewusst auf eine kurze Aufbewahrung begrenzt, damit sie zeitnah
            nach dem Löschtermin auslaufen. Du kannst deinen Stand auch selbst jederzeit vorher
            vollständig löschen: unter{" "}
            <a href="#mein-stand" className="underline">
              „Mein Stand"
            </a>{" "}
            mit deinem Zugangscode einloggen und „Stand und Daten löschen" wählen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">7. Kartenkacheln und Geocoding</h2>
          <p>
            Die Kartendarstellung lädt Kartenkacheln von OpenFreeMap (openfreemap.org). Dabei wird,
            wie bei jedem Webseitenaufruf, deine IP-Adresse an diesen Dienst übertragen; OpenFreeMap
            ist ein nichtkommerzielles Projekt, das nach eigenen Angaben kein Tracking einsetzt. Um
            deine eingegebene Adresse in Kartenkoordinaten umzuwandeln, übermitteln wir sie einmalig
            an OpenCage als weiteren Auftragsverarbeiter. OpenCage selbst hostet nach eigenen
            Angaben ausschließlich bei Hetzner in Deutschland - das betrifft nur diesen einen
            Verarbeitungsschritt bei OpenCage, nicht unsere eigene Infrastruktur (siehe Abschnitt 8:
            wir selbst hosten bei Scaleway). Weitere Inhalte von Drittservern werden nicht geladen;
            Schriftarten sind vollständig selbst gehostet.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">
            8. Hosting und Auftragsverarbeitung
          </h2>
          <p>
            Die App läuft auf Servern von Scaleway (Frankreich) innerhalb der EU. Scaleway
            verarbeitet Daten dabei ausschließlich in unserem Auftrag als Auftragsverarbeiter (Art.
            28 DSGVO), auf Basis eines Auftragsverarbeitungsvertrags. Unsere Anwendung protokolliert
            bewusst keine personenbezogenen Daten oder Zugangscodes in ihren Logs. Es werden keine
            Cookies gesetzt und keine Analyse- oder Trackingdienste eingebunden.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-gray-900">9. Deine Rechte</h2>
          <p>
            Dir stehen die Betroffenenrechte nach Art. 15–21 DSGVO zu (Auskunft, Berichtigung,
            Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit) sowie das Recht, eine
            Einwilligung jederzeit zu widerrufen (siehe Abschnitt 4). Eine vollständige Auskunft
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
