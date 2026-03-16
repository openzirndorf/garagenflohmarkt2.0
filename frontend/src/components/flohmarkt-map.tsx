import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
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
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

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

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolokalisierung nicht unterstützt");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) return;

        const pointData: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [lng, lat] },
              properties: {},
            },
          ],
        };

        if (map.getSource("user-location")) {
          (map.getSource("user-location") as maplibregl.GeoJSONSource).setData(pointData);
        } else {
          map.addSource("user-location", { type: "geojson", data: pointData });
          map.addLayer({
            id: "user-location-halo",
            type: "circle",
            source: "user-location",
            paint: {
              "circle-radius": 16,
              "circle-color": "#2563eb",
              "circle-opacity": 0.2,
              "circle-stroke-width": 0,
            },
          });
          map.addLayer({
            id: "user-location-pin",
            type: "circle",
            source: "user-location",
            paint: {
              "circle-radius": 8,
              "circle-color": "#2563eb",
              "circle-stroke-width": 3,
              "circle-stroke-color": "#fff",
            },
          });
        }

        map.flyTo({ center: [lng, lat], zoom: 15 });
        setLocating(false);
      },
      (err) => {
        setLocationError(err.code === 1 ? "Zugriff verweigert" : "Standort nicht verfügbar");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        role="img"
        aria-label="Karte mit Garagenflohmarkt-Ständen in Zirndorf"
      />
      {/* Standort-Button */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          title="Meinen Standort anzeigen"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-md hover:bg-gray-50 disabled:opacity-50"
        >
          {locating ? (
            <span className="text-sm">⌛</span>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
            </svg>
          )}
        </button>
        {locationError && (
          <div className="rounded bg-white px-2 py-1 text-xs text-red-600 shadow">
            {locationError}
          </div>
        )}
      </div>
    </div>
  );
}
