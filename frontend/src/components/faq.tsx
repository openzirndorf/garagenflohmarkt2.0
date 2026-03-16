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

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Wer darf mitmachen?
        </h2>
        <ul className="flex flex-col gap-2 text-gray-700">
          <li className="flex gap-2">
            <span className="text-[--oz-green] font-bold shrink-0">✓</span>
            <span>
              <strong>Nur Privatpersonen</strong> – gewerbliche Anbieter sind nicht zugelassen.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[--oz-green] font-bold shrink-0">✓</span>
            <span>
              <strong>Nur innerhalb Zirndorfs</strong> – dein Stand muss sich im Stadtgebiet
              befinden.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[--oz-green] font-bold shrink-0">✓</span>
            <span>
              <strong>Nur gebrauchte Waren</strong> – neue Produkte oder gewerbliche Artikel
              sind verboten.
            </span>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Was ist verboten?
        </h2>
        <ul className="flex flex-col gap-2 text-gray-700">
          {[
            "Neue Produkte und gewerbliche Artikel",
            "Lebensmittel und Kosmetik",
            "Fahrzeuge (außer Spielzeug)",
            "Waffen jeglicher Art",
            "Politisches Material",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-red-500 font-bold shrink-0">✗</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Aufstellung & Markierung
        </h2>
        <ul className="flex flex-col gap-2 text-gray-700">
          <li className="flex gap-2">
            <span className="text-[--oz-green] font-bold shrink-0">✓</span>
            <span>
              Dein Stand muss sich <strong>ausschließlich auf deinem Privatgrundstück</strong>{" "}
              befinden – nicht auf Gehwegen oder öffentlichen Flächen.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[--oz-green] font-bold shrink-0">✓</span>
            <span>
              Markiere deinen Stand mit <strong>mindestens 3 bunten Luftballons</strong>, damit
              Besucher ihn leicht finden.
            </span>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Haftung
        </h2>
        <p className="text-gray-700">
          Jeder Teilnehmer trägt <strong>selbst die volle Verantwortung</strong> für
          Versicherung, Sicherheit und etwaige Schäden an seinem Stand. Der Betreiber dieser
          Seite übernimmt keine Haftung für Vorfälle oder Streitigkeiten.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Häufige Fragen
        </h2>
        <div className="flex flex-col gap-4">
          <div className="border-l-4 border-[--oz-green] pl-4">
            <p className="font-semibold text-gray-800">
              Bis wann kann ich meinen Stand anmelden?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Anmeldungen sind bis zum Veranstaltungstag möglich, solange die Seite aktiv ist.
            </p>
          </div>
          <div className="border-l-4 border-[--oz-green] pl-4">
            <p className="font-semibold text-gray-800">Kostet die Teilnahme etwas?</p>
            <p className="text-gray-600 text-sm mt-1">
              Nein, die Teilnahme ist kostenlos.
            </p>
          </div>
          <div className="border-l-4 border-[--oz-green] pl-4">
            <p className="font-semibold text-gray-800">Warum muss ich meine E-Mail bestätigen?</p>
            <p className="text-gray-600 text-sm mt-1">
              Die E-Mail-Bestätigung verhindert Spam und stellt sicher, dass du deinen Stand
              später verwalten kannst.
            </p>
          </div>
          <div className="border-l-4 border-[--oz-green] pl-4">
            <p className="font-semibold text-gray-800">
              Kann ich meinen Stand nach der Anmeldung noch ändern?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Ja – über den Link in deiner Bestätigungsmail oder im Browser gespeicherten Link
              kannst du Name, Adresse und Beschreibung jederzeit bearbeiten.
            </p>
          </div>
          <div className="border-l-4 border-[--oz-green] pl-4">
            <p className="font-semibold text-gray-800">
              Was passiert, wenn mein Stand nicht auf der Karte erscheint?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Prüfe, ob du den Bestätigungslink in der Mail angeklickt hast. Ohne Bestätigung
              bleibt dein Stand unsichtbar. Auch muss die eingetragene Adresse in Zirndorf
              liegen, damit sie auf der Karte angezeigt werden kann.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
