import { describe, expect, it } from "vitest";
import { spreadCoincidentPoints } from "./map-declutter";

function pointFeature(id: number, lng: number, lat: number): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: { id },
    geometry: { type: "Point", coordinates: [lng, lat] },
  };
}

describe("spreadCoincidentPoints", () => {
  it("leaves a single stand at its exact coordinates untouched", () => {
    const result = spreadCoincidentPoints({
      type: "FeatureCollection",
      features: [pointFeature(1, 10.9557, 49.4467)],
    });

    expect(result.features[0].geometry).toEqual({ type: "Point", coordinates: [10.9557, 49.4467] });
  });

  it("leaves clearly distinct addresses untouched", () => {
    const result = spreadCoincidentPoints({
      type: "FeatureCollection",
      features: [pointFeature(1, 10.9557, 49.4467), pointFeature(2, 10.96, 49.45)],
    });

    expect(result.features[0].geometry).toEqual({ type: "Point", coordinates: [10.9557, 49.4467] });
    expect(result.features[1].geometry).toEqual({ type: "Point", coordinates: [10.96, 49.45] });
  });

  it("spreads two stands at the exact same address into distinct, clickable points", () => {
    const result = spreadCoincidentPoints({
      type: "FeatureCollection",
      features: [pointFeature(1, 10.9557, 49.4467), pointFeature(2, 10.9557, 49.4467)],
    });

    const [a, b] = result.features.map((f) => (f.geometry as GeoJSON.Point).coordinates);
    expect(a).not.toEqual(b);
    // Beide bleiben nah an der echten Adresse (Größenordnung Meter, nicht
    // versehentlich an einer anderen Straße gelandet).
    for (const [lng, lat] of [a, b]) {
      expect(Math.abs(lng - 10.9557)).toBeLessThan(0.001);
      expect(Math.abs(lat - 49.4467)).toBeLessThan(0.001);
    }
  });

  it("gives three stands at the same address three mutually distinct points", () => {
    const result = spreadCoincidentPoints({
      type: "FeatureCollection",
      features: [
        pointFeature(1, 10.9557, 49.4467),
        pointFeature(2, 10.9557, 49.4467),
        pointFeature(3, 10.9557, 49.4467),
      ],
    });

    const coords = result.features.map((f) => (f.geometry as GeoJSON.Point).coordinates);
    const unique = new Set(coords.map((c) => c.join(",")));
    expect(unique.size).toBe(3);
  });

  it("does not confuse two independently identical-looking addresses in different filter runs", () => {
    // Regression: nur der aktuell übergebene (ggf. gefilterte) Ausschnitt
    // zählt für die Gruppierung, nicht ein globaler Zustand - ein Stand,
    // der allein übrig bleibt, bekommt seine echte Adresse zurück.
    const onlyOneLeft = spreadCoincidentPoints({
      type: "FeatureCollection",
      features: [pointFeature(1, 10.9557, 49.4467)],
    });
    expect(onlyOneLeft.features[0].geometry).toEqual({
      type: "Point",
      coordinates: [10.9557, 49.4467],
    });
  });
});
