import { describe, expect, it } from "vitest";
import { buildStandPopupContent } from "./stand-popup";

describe("buildStandPopupContent", () => {
  it("renders user-submitted fields as escaped text, not executable markup", () => {
    const node = buildStandPopupContent({
      id: 1,
      nickname: "Fröhlicher Dachs",
      adresse: "Musterstraße 1",
      beschreibung: "<img src=x onerror=alert(1)>",
    });

    // Kein <img>-Element darf im DOM landen - der Payload muss als reiner
    // Textknoten vorliegen.
    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("does not interpret HTML in the nickname either", () => {
    const node = buildStandPopupContent({
      id: 1,
      nickname: "<script>alert(1)</script>",
      adresse: "Musterstraße 1",
      beschreibung: null,
    });

    expect(node.querySelector("script")).toBeNull();
    expect(node.textContent).toContain("<script>alert(1)</script>");
  });

  it("includes beschreibung only when present", () => {
    const withDescription = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: "Alte Bücher und Spielzeug",
    });
    expect(withDescription.textContent).toContain("Alte Bücher und Spielzeug");

    const withoutDescription = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
    });
    expect(withoutDescription.textContent).not.toContain("Alte Bücher");
  });

  it("includes kategorien only when present", () => {
    const withKategorien = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
      kategorien: ["Bücher", "Spielzeug"],
    });
    expect(withKategorien.textContent).toContain("Bücher, Spielzeug");

    const withoutKategorien = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
      kategorien: [],
    });
    expect(withoutKategorien.textContent).not.toContain("Bücher");
  });

  // Regression: MapLibre GL liefert Array-Properties eines Klick-Events
  // (feature.properties) als JSON-String statt als Array zurück, anders
  // als beim direkten Aufruf hier oder aus dem rohen GeoJSON-Fetch. Ohne
  // Abfangen warf das einen unbehandelten Fehler ("kategorien.join is
  // not a function"), der den kompletten Klick-Handler abbrach - Klicks
  // auf einen Stand wirkten dadurch live komplett wirkungslos.
  it("handles kategorien/zahlungsarten arriving as JSON-encoded strings (MapLibre click events)", () => {
    const node = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
      kategorien: '["Bücher","Spielzeug"]',
      zahlungsarten: '["PayPal"]',
    });
    expect(node.textContent).toContain("Bücher, Spielzeug");
    expect(node.textContent).toContain("💳 PayPal");
  });

  it("includes zahlungsarten only when present", () => {
    const withZahlungsarten = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
      zahlungsarten: ["PayPal", "Barzahlung"],
    });
    expect(withZahlungsarten.textContent).toContain("💳 PayPal, 💵 Barzahlung");

    const withoutZahlungsarten = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
      zahlungsarten: [],
    });
    expect(withoutZahlungsarten.textContent).not.toContain("PayPal");
  });

  it("includes a navigation link only when coordinates are given", () => {
    const withCoords = buildStandPopupContent(
      {
        id: 1,
        nickname: "Flotte Eule",
        adresse: "Teststraße 2",
        beschreibung: null,
      },
      { lat: 49.4, lng: 10.9 },
    );
    const link = withCoords.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.href).toContain("49.4");

    const withoutCoords = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
    });
    expect(withoutCoords.querySelector("a")).toBeNull();
  });

  it("includes a favorite toggle only when favorite controls are given", () => {
    let favorited = false;
    const withFavorite = buildStandPopupContent(
      {
        id: 42,
        nickname: "Flotte Eule",
        adresse: "Teststraße 2",
        beschreibung: null,
      },
      null,
      {
        isFavorite: (id) => id === 42 && favorited,
        onToggle: () => {
          favorited = true;
        },
      },
    );
    const favBtn = withFavorite.querySelector("button");
    expect(favBtn).not.toBeNull();
    expect(favBtn?.textContent).toBe("+ Favoriten");

    favBtn?.click();
    expect(favorited).toBe(true);
    expect(favBtn?.textContent).toBe("★ Favorit");

    const withoutFavorite = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
    });
    expect(withoutFavorite.querySelector("button")).toBeNull();
  });
});
