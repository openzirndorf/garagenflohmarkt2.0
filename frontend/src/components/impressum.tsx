export function Impressum() {
  const goHome = () => {
    window.location.hash = "";
  };
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
        Impressum
      </h1>

      {/* Übernommen aus dem Impressum von openzirndorf.de - dort die
          maßgebliche, gepflegte Quelle (z.B. bei einem Vorstandswechsel).
          Diese Kopie bei Änderungen dort mit aktualisieren. */}
      <p className="text-gray-600">
        <strong>OpenZirndorf (i.G.)</strong>
        <br />
        Erich-Kästner-Weg 33
        <br />
        90513 Zirndorf
      </p>

      <p className="text-gray-600">
        Vertreten durch den Vorstand:
        <br />
        Fabian Hartmann (Vorsitzender)
        <br />
        Andreas Bechtloff (Stellvertretender Vorsitzender)
        <br />
        Sigrun Seifert (Schatzmeisterin)
        <br />
        Christoph Müller (Schriftführer)
      </p>

      <p className="text-gray-600">
        Der Verein wurde am 6. August 2026 gegründet und befindet sich derzeit in Gründung (i.G.).
        Er ist noch nicht in das Vereinsregister eingetragen.
      </p>

      <p className="text-gray-600">
        E-Mail:{" "}
        <a href="mailto:team@openzirndorf.de" className="text-[#009a00] hover:underline">
          team@openzirndorf.de
        </a>
      </p>

      <p className="text-sm text-gray-500">entwickelt mit ❤️ in Zirndorf</p>
    </div>
  );
}
