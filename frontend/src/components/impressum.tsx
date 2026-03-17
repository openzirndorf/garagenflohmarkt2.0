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

      <p className="text-gray-600">
        <strong>OpenZirndorf</strong>
        <br />
        Fabian Hartmann
        <br />
        Erich-Kästner-Weg 33
        <br />
        90513 Zirndorf
      </p>

      <p className="text-gray-600">
        E-Mail:{" "}
        <a href="mailto:fabian@openzirndorf.de" className="text-[#009a00] hover:underline">
          fabian@openzirndorf.de
        </a>
      </p>

      <p className="text-sm text-gray-500">entwickelt mit ❤️ in Zirndorf</p>
    </div>
  );
}
