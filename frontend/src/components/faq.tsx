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
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Was ist verboten?
        </h2>
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Aufstellung, Erlaubnis & Sicherheit
        </h2>
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
              <strong>Stand gut sichern</strong>, damit z.B. bei Wind nichts umkippt oder wegfliegt.
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Haftung
        </h2>
        <p className="text-gray-700">
          Jeder Teilnehmer trägt <strong>selbst die volle Verantwortung</strong> für seinen Stand.
          Der Betreiber dieser Seite übernimmt keine Haftung für Schäden, Vorfälle oder
          Streitigkeiten. Versicherungstechnische Fragen kläre bitte direkt mit dem Eigentümer oder
          der Hausverwaltung des Grundstücks.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Häufige Fragen
        </h2>
        <div className="flex flex-col gap-4">
          <div className="border-l-4 border-[#009a00] pl-4">
            <p className="font-semibold text-gray-800">Bis wann kann ich meinen Stand anmelden?</p>
            <p className="text-gray-600 text-sm mt-1">
              Anmeldungen sind bis zum Veranstaltungstag möglich, solange die Seite aktiv ist.
            </p>
          </div>
          <div className="border-l-4 border-[#009a00] pl-4">
            <p className="font-semibold text-gray-800">Kostet die Teilnahme etwas?</p>
            <p className="text-gray-600 text-sm mt-1">Nein, die Teilnahme ist kostenlos.</p>
          </div>
          <div className="border-l-4 border-[#009a00] pl-4">
            <p className="font-semibold text-gray-800">Warum muss ich meine E-Mail bestätigen?</p>
            <p className="text-gray-600 text-sm mt-1">
              Die E-Mail-Bestätigung verhindert Spam und stellt sicher, dass du deinen Stand später
              verwalten kannst.
            </p>
          </div>
          <div className="border-l-4 border-[#009a00] pl-4">
            <p className="font-semibold text-gray-800">
              Kann ich meinen Stand nach der Anmeldung noch ändern?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Ja – über den Link in deiner Bestätigungsmail (oder jederzeit über „Mein Stand" neu
              anfordern) kannst du Standname, Adresse und Beschreibung jederzeit bearbeiten.
            </p>
          </div>
          <div className="border-l-4 border-[#009a00] pl-4">
            <p className="font-semibold text-gray-800">
              Was passiert, wenn mein Stand nicht auf der Karte erscheint?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Prüfe, ob du den Bestätigungscode in der Mail unter „Mein Stand" eingegeben hast. Ohne
              Bestätigung bleibt dein Stand unsichtbar. Auch muss die eingetragene Adresse in
              Zirndorf liegen, damit sie auf der Karte angezeigt werden kann.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
