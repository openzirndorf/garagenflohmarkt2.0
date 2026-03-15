import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchGeoJSON } from "../api";

// Zirndorf Zentrum
const CENTER: [number, number] = [10.9557, 49.4467];
const ZOOM = 13;

export function FlohmarktMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: CENTER,
      zoom: ZOOM,
    });
    mapRef.current = map;

    map.on("load", async () => {
      try {
        const geojson = await fetchGeoJSON();
        map.addSource("stands", { type: "geojson", data: geojson });
        map.addLayer({
          id: "stands-pins",
          type: "circle",
          source: "stands",
          paint: {
            "circle-radius": 10,
            "circle-color": "#009A00",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
        map.on("click", "stands-pins", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const { name, adresse, beschreibung } = feature.properties as {
            name: string;
            adresse: string;
            beschreibung: string;
          };
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `<strong>${name}</strong><br>${adresse}${beschreibung ? `<br>${beschreibung}` : ""}`,
            )
            .addTo(map);
        });
        map.on("mouseenter", "stands-pins", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "stands-pins", () => {
          map.getCanvas().style.cursor = "";
        });
      } catch (err) {
        console.error("Karte konnte Stände nicht laden:", err);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "400px" }}
      role="img"
      aria-label="Karte mit Garagenflohmarkt-Ständen in Zirndorf"
    />
  );
}
