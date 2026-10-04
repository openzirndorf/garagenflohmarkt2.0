import { afterEach, describe, expect, it, vi } from "vitest";
import { navigationUrl } from "./navigation-url";

const setUserAgent = (ua: string) => {
  vi.stubGlobal("navigator", { userAgent: ua, maxTouchPoints: 0 });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("navigationUrl", () => {
  // Live gemeldet: "Navigieren" funktionierte auf iOS, aber nicht auf
  // Android. Ursache: target="_blank" verhindert auf Android Chrome
  // zuverlässig, dass ein geo:-Link als Intent an die Karten-App
  // weitergereicht wird. newTab muss für Android deshalb false sein -
  // der eigentliche Regressionsschutz für diesen Bug.
  it("liefert auf Android einen geo:-Link ohne neuen Tab", () => {
    setUserAgent(ANDROID_UA);
    const result = navigationUrl(49.4467, 10.9557, "Musterstraße 1");
    expect(result.url).toBe("geo:49.4467,10.9557?q=49.4467,10.9557(Musterstra%C3%9Fe%201)");
    expect(result.newTab).toBe(false);
  });

  it("liefert auf iOS einen Apple-Maps-Link ohne neuen Tab", () => {
    setUserAgent(IOS_UA);
    const result = navigationUrl(49.4467, 10.9557, "Musterstraße 1");
    expect(result.url).toBe("https://maps.apple.com/?ll=49.4467,10.9557&q=Musterstra%C3%9Fe%201");
    expect(result.newTab).toBe(false);
  });

  it("liefert am Desktop einen OSM-Link mit neuem Tab", () => {
    setUserAgent(DESKTOP_UA);
    const result = navigationUrl(49.4467, 10.9557, "Musterstraße 1");
    expect(result.url).toBe(
      "https://www.openstreetmap.org/directions?to=49.4467%2C10.9557#map=17/49.4467/10.9557",
    );
    expect(result.newTab).toBe(true);
  });
});
