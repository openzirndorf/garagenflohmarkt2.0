// Mehrere Stände an derselben (oder einer auf ein paar cm genau gleich
// geocodierten) Adresse landen sonst exakt übereinander - ihre Kreise
// überlappen dann pixelgenau, ein Klick trifft bei MapLibre nur den
// obersten, der zweite Stand wäre auf der Karte praktisch unklickbar (in
// der Liste bleibt er normal sichtbar, das Problem betrifft nur die
// Karte, siehe flohmarkt-map.tsx). Ordnet solche Gruppen stattdessen in
// einem kleinen Kreis um den Original-Punkt an. Bewusst klein gehalten
// (~4-5m, war anfangs 0.00015/~15-20m) - der Punkt soll optisch noch
// erkennbar am selben Gebäude/Grundstück bleiben, nicht wie ein
// eigenständiger, falscher Nachbar-Standort wirken. Sichtbar getrennt
// bleiben die Punkte trotzdem, da der Kreisradius selbst (10px) bei
// typischem Zoom größer ist als die paar Meter Versatz in Bildschirm-
// Pixeln.
export const COINCIDENT_OFFSET_DEGREES = 0.00004;

export function spreadCoincidentPoints(
  collection: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  const groups = new Map<string, GeoJSON.Feature[]>();
  for (const f of collection.features) {
    if (f.geometry.type !== "Point") continue;
    const [lng, lat] = f.geometry.coordinates;
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    const group = groups.get(key);
    if (group) group.push(f);
    else groups.set(key, [f]);
  }

  return {
    type: "FeatureCollection",
    features: collection.features.map((f) => {
      if (f.geometry.type !== "Point") return f;
      const [lng, lat] = f.geometry.coordinates;
      const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
      const group = groups.get(key);
      if (!group || group.length < 2) return f;

      const index = group.indexOf(f);
      const angle = (2 * Math.PI * index) / group.length;
      // Längengrad-Versatz mit 1/cos(Breite) skaliert, sonst wäre der
      // reale Meter-Abstand in Ost-West-Richtung kleiner als in
      // Nord-Süd-Richtung (ein Längengrad ist in der Realität kürzer als
      // ein Breitengrad, außer am Äquator).
      const lngOffset =
        (COINCIDENT_OFFSET_DEGREES * Math.cos(angle)) / Math.cos((lat * Math.PI) / 180);
      const latOffset = COINCIDENT_OFFSET_DEGREES * Math.sin(angle);
      return {
        ...f,
        geometry: { ...f.geometry, coordinates: [lng + lngOffset, lat + latOffset] },
      };
    }),
  };
}
