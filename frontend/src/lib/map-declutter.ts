// Mehrere Stände an derselben (oder einer auf ein paar cm genau gleich
// geocodierten) Adresse landen sonst exakt übereinander - ihre Kreise
// überlappen dann pixelgenau, ein Klick trifft bei MapLibre nur den
// obersten, der zweite Stand wäre auf der Karte praktisch unklickbar (in
// der Liste bleibt er normal sichtbar, das Problem betrifft nur die
// Karte, siehe flohmarkt-map.tsx). Ordnet solche Gruppen stattdessen in
// einem kleinen Kreis um den Original-Punkt an. ~15-20m Radius - sichtbar
// getrennt etwa ab Straßen-Zoomstufe; bei der Zirndorf-weiten
// Startansicht sind auch nicht-doppelte, benachbarte Adressen kaum
// unterscheidbar, das ist keine Regression durch diesen Versatz.
export const COINCIDENT_OFFSET_DEGREES = 0.00015;

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
