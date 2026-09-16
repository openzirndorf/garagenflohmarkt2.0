import { describe, expect, it } from "vitest";
import { extractOrtsteil } from "./ortsteil";

describe("extractOrtsteil", () => {
  it("extracts the Ortsteil from a formatted address", () => {
    expect(extractOrtsteil("Märzenweg 14, 90513 Zirndorf (Weiherhof)")).toBe("Weiherhof");
  });

  it("returns null for a Kernstadt address without an Ortsteil suffix", () => {
    expect(extractOrtsteil("Hauptstraße 44, 90513 Zirndorf")).toBeNull();
  });

  it("returns null for unrelated parentheses elsewhere in the text", () => {
    // Muss am Ende stehen, nicht irgendwo im Text - sonst könnte z.B. eine
    // Beschreibung mit Klammern fälschlich als Ortsteil erkannt werden
    // (auch wenn adresse selbst nie Freitext ist, testet das die
    // Grenze des Musters).
    expect(extractOrtsteil("Musterstraße (Hinterhof) 1, 90513 Zirndorf")).toBeNull();
  });

  it("does not match a name that isn't a known Ortsteil", () => {
    expect(extractOrtsteil("Musterstraße 1, 90513 Zirndorf (Nürnberg)")).toBeNull();
  });
});
