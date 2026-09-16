import { describe, expect, it } from "vitest";
import { composeAdresse, splitAdresse } from "./adresse";

describe("composeAdresse", () => {
  it("baut die einheitlich formatierte Adresse aus Straße und Hausnummer", () => {
    expect(composeAdresse("Musterstraße", "12")).toBe("Musterstraße 12, 90513 Zirndorf");
  });

  it("trimmt Leerzeichen an beiden Feldern", () => {
    expect(composeAdresse("  Musterstraße  ", " 12a ")).toBe("Musterstraße 12a, 90513 Zirndorf");
  });
});

describe("splitAdresse", () => {
  it("zerlegt eine einheitlich formatierte Adresse zurück in ihre Teile", () => {
    expect(splitAdresse("Musterstraße 12, 90513 Zirndorf")).toEqual({
      strasse: "Musterstraße",
      hausnummer: "12",
    });
  });

  it("funktioniert bei einer Straße mit mehreren Wörtern", () => {
    expect(splitAdresse("Erich-Kästner-Weg 33, 90513 Zirndorf")).toEqual({
      strasse: "Erich-Kästner-Weg",
      hausnummer: "33",
    });
  });

  it("ignoriert einen angehängten Ortsteil-Suffix", () => {
    expect(splitAdresse("Breslauer Straße 51, 90513 Zirndorf (Weiherhof)")).toEqual({
      strasse: "Breslauer Straße",
      hausnummer: "51",
    });
  });

  it("gibt null zurück, wenn die Adresse nicht dem erwarteten Muster entspricht", () => {
    expect(splitAdresse("Irgendwas Freitext ohne Struktur")).toBeNull();
  });
});
