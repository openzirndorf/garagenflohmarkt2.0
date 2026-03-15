export function Impressum() {
  const goHome = () => {
    window.location.hash = "";
  };
  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <button
          type="button"
          onClick={goHome}
          className="mb-4 inline-block text-sm text-[--oz-green] hover:underline"
        >
          ← Zurück
        </button>
        <h1 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-3xl font-extrabold">
          Impressum
        </h1>
      </div>

      <section className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Angaben gemäß § 5 TMG</h2>
        <p className="text-gray-600">
          Fabian Hartmann
          <br />
          Erich-Kästner-Weg 33
          <br />
          90513 Zirndorf
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Kontakt</h2>
        <p className="text-gray-600">
          E-Mail:{" "}
          <a href="mailto:kontakt@openzirndorf.de" className="text-[--oz-green] hover:underline">
            kontakt@openzirndorf.de
          </a>
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Hinweis</h2>
        <p className="text-sm text-gray-500">
          Dies ist ein gemeinschaftliches, nicht-kommerzielles Projekt der Zirndorfer Bürgerinnen
          und Bürger. Es besteht keine Verbindung zur Stadt Zirndorf.
        </p>
      </section>
    </div>
  );
}
