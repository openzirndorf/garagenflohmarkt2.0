import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchGeoJSON } from "../api";
import { type StandPopupProperties, buildStandPopupContent } from "../lib/stand-popup";

// Zirndorf Zentrum
const CENTER: [number, number] = [10.9557, 49.4467];
const ZOOM = 13;

interface Props {
  kategorienFilter?: string[];
  onError?: () => void;
}

export function FlohmarktMap({ kategorienFilter = [], onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const allGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);
  // "Latest ref"-Muster: der Mount-once-Effekt unten soll onError nicht neu
  // registrieren müssen, wenn die Elternkomponente eine neue Funktionsreferenz
  // übergibt (z.B. eine Inline-Arrow-Function bei jedem Render).
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: CENTER,
      zoom: ZOOM,
    });
    mapRef.current = map;

    // Kein Live-Fallback auf einen Drittanbieter (z.B. OpenFreeMap), wenn
    // die eigenen Kacheln/der Style nicht laden - das würde die
    // EU-only-Garantie im Fehlerfall aufweichen. Stattdessen wird auf die
    // (bereits barrierefreie) Listenansicht umgeschaltet, siehe map-or-list.tsx.
    map.on("error", () => onErrorRef.current?.());

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
          const popupNode = buildStandPopupContent(feature.properties as StandPopupProperties);
          new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(popupNode).addTo(map);
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
