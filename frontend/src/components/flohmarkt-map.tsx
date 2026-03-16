import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchGeoJSON } from "../api";

// Zirndorf Zentrum
const CENTER: [number, number] = [10.9557, 49.4467];
const ZOOM = 13;

interface Props {
  kategorienFilter?: string[];
}

export function FlohmarktMap({ kategorienFilter = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const allGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: CENTER,
      zoom: ZOOM,
    });
    mapRef.current = map;

    // Geolocation-Button (built-in MapLibre control)
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: false },
        trackUserLocation: false,
        showUserLocation: true,
      }),
      "top-right",
    );

    map.on("load", async () => {
      try {
        const geojson = await fetchGeoJSON();
        allGeoJSONRef.current = geojson;
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
          const { name, adresse, beschreibung, uhrzeit } = feature.properties as {
            name: string;
            adresse: string;
            beschreibung: string;
            uhrzeit: string | null;
          };
          const lines = [
            `<strong>${name}</strong>`,
            adresse,
            uhrzeit ? `🕐 ${uhrzeit}` : null,
            beschreibung || null,
          ]
            .filter(Boolean)
            .join("<br>");
          new maplibregl.Popup().setLngLat(e.lngLat).setHTML(lines).addTo(map);
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

  // Re-filter when kategorienFilter changes
  useEffect(() => {
    const map = mapRef.current;
    const all = allGeoJSONRef.current;
    if (!map || !all) return;

    const filtered: GeoJSON.FeatureCollection =
      kategorienFilter.length === 0
        ? all
        : {
            type: "FeatureCollection",
            features: all.features.filter((f) => {
              const cats = (f.properties?.kategorien ?? []) as string[];
              return cats.some((k) => kategorienFilter.includes(k));
            }),
          };

    const source = map.getSource("stands") as maplibregl.GeoJSONSource | undefined;
    source?.setData(filtered);
  }, [kategorienFilter]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
      role="img"
      aria-label="Karte mit Garagenflohmarkt-Ständen in Zirndorf"
    />
  );
}
