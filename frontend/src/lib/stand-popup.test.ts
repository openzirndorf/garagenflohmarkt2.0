import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("does not interpret HTML in the address either", () => {
    const node = buildStandPopupContent({
      id: 1,
      nickname: "Fröhlicher Dachs",
      adresse: "<script>alert(1)</script>",
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

  // Regression: der Melden-Button öffnete früher ein nacktes window.prompt() -
  // jetzt einen eigenen, zum Design passenden Dialog (siehe openReportDialog
  // in stand-popup.ts). Der Dialog hängt bewusst am document.body, nicht am
  // Popup-Node selbst (Platz im Popup reicht dafür nicht).
  describe("report dialog", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    function findButton(root: HTMLElement, text: string): HTMLButtonElement {
      const btn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === text);
      if (!btn) throw new Error(`Button "${text}" nicht gefunden`);
      return btn;
    }

    it("requires a non-empty reason before submitting", () => {
      const onReport = vi.fn().mockResolvedValue(undefined);
      const node = buildStandPopupContent(
        { id: 1, nickname: "Flotte Eule", adresse: "Teststraße 2", beschreibung: null },
        null,
        null,
        { onReport },
      );
      document.body.appendChild(node);

      findButton(node, "🚩 Melden").click();
      const dialog = document.body.querySelector("textarea")?.closest("div");
      expect(dialog).not.toBeNull();

      findButton(document.body as unknown as HTMLElement, "Melden").click();
      expect(onReport).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("Bitte einen Grund angeben.");
    });

    it("submits the trimmed reason and closes the dialog", async () => {
      const onReport = vi.fn().mockResolvedValue(undefined);
      const node = buildStandPopupContent(
        { id: 7, nickname: "Flotte Eule", adresse: "Teststraße 2", beschreibung: null },
        null,
        null,
        { onReport },
      );
      document.body.appendChild(node);

      findButton(node, "🚩 Melden").click();
      const textarea = document.body.querySelector("textarea") as HTMLTextAreaElement;
      textarea.value = "  Falsche Adresse  ";
      findButton(document.body as unknown as HTMLElement, "Melden").click();

      expect(onReport).toHaveBeenCalledWith(7, "Falsche Adresse");
      expect(document.body.querySelector("textarea")).toBeNull();
    });

    it("cancels without reporting when Abbrechen is clicked", () => {
      const onReport = vi.fn().mockResolvedValue(undefined);
      const node = buildStandPopupContent(
        { id: 1, nickname: "Flotte Eule", adresse: "Teststraße 2", beschreibung: null },
        null,
        null,
        { onReport },
      );
      document.body.appendChild(node);

      findButton(node, "🚩 Melden").click();
      findButton(document.body as unknown as HTMLElement, "Abbrechen").click();

      expect(onReport).not.toHaveBeenCalled();
      expect(document.body.querySelector("textarea")).toBeNull();
    });
  });
});
