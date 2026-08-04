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
    const star = withFavorite.querySelector("button");
    expect(star).not.toBeNull();
    expect(star?.textContent).toBe("☆");

    star?.click();
    expect(favorited).toBe(true);
    expect(star?.textContent).toBe("★");

    const withoutFavorite = buildStandPopupContent({
      id: 1,
      nickname: "Flotte Eule",
      adresse: "Teststraße 2",
      beschreibung: null,
    });
    expect(withoutFavorite.querySelector("button")).toBeNull();
  });
});
