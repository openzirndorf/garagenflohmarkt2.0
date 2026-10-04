/* Navigation zum Stand: auf Android öffnet geo: die Karten-App, auf iOS
   kennt Safari geo: gar nicht (öffnet nichts!) - dort braucht es den
   Apple-Maps-Universal-Link. Am Desktop führt der Link zum OSM-Routing.
   Bewusst kein Google Maps (EU-Only-Anspruch der App) - dieselbe Lösung
   wie im sommerdetektive-Projekt. */
export interface NavigationLink {
  url: string;
  // Live gemeldet: "Navigieren" funktionierte auf iOS, aber nicht auf
  // Android. Ursache: target="_blank" verhindert auf Android Chrome
  // zuverlässig, dass ein geo:-Link als Intent an die Karten-App
  // weitergereicht wird (bestätigt u.a. in installierten PWAs/Standalone-
  // Fenstern, dem Betriebsmodus dieser App) - der Link tut dann einfach
  // nichts. iOS betrifft das nicht, da maps.apple.com ein normaler
  // https-Universal-Link ist, den iOS unabhängig vom Tab-Ziel abfängt.
  // Nur beim Desktop-OSM-Fallback (echte Website, kein App-Handoff) macht
  // ein neuer Tab Sinn, damit die eigene Seite nicht verloren geht.
  newTab: boolean;
}

export function navigationUrl(lat: number, lng: number, title: string): NavigationLink {
  const ua = navigator.userAgent;
  // iPadOS meldet sich seit Version 13 standardmäßig als "Macintosh" -
  // Touch-Unterstützung unterscheidet es von echten Macs.
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return {
      url: `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(title)}`,
      newTab: false,
    };
  }
  if (/Android/i.test(ua)) {
    return {
      url: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(title)})`,
      newTab: false,
    };
  }
  return {
    url: `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=17/${lat}/${lng}`,
    newTab: true,
  };
}
