/* Navigation zum Stand: auf Android öffnet geo: die Karten-App, auf iOS
   kennt Safari geo: gar nicht (öffnet nichts!) - dort braucht es den
   Apple-Maps-Universal-Link. Am Desktop führt der Link zum OSM-Routing.
   Bewusst kein Google Maps (EU-Only-Anspruch der App) - dieselbe Lösung
   wie im sommerdetektive-Projekt. */
export function navigationUrl(lat: number, lng: number, title: string): string {
  const ua = navigator.userAgent;
  // iPadOS meldet sich seit Version 13 standardmäßig als "Macintosh" -
  // Touch-Unterstützung unterscheidet es von echten Macs.
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(title)}`;
  }
  if (/Android/i.test(ua)) {
    return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(title)})`;
  }
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=17/${lat}/${lng}`;
}
