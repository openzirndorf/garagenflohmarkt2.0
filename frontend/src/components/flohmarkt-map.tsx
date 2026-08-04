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
  showFavoritesOnly?: boolean;
  favoriteIds: Set<number>;
  onToggleFavorite: (id: number) => void;
  onError?: () => void;
}

export function FlohmarktMap({
  kategorienFilter = [],
  showFavoritesOnly = false,
  favoriteIds,
  onToggleFavorite,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const allGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);
  // "Latest ref"-Muster: der Mount-once-Effekt unten registriert den
  // Klick-Handler nur einmal (siehe map.on("load", ...)), soll aber trotzdem
  // immer den aktuellen Favoriten-Stand sehen, statt den bei Mount
  // eingefrorenen (z.B. onError bei einer neuen Inline-Arrow-Function).
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
  const onToggleFavoriteRef = useRef(onToggleFavorite);
  onToggleFavoriteRef.current = onToggleFavorite;

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
          const coords =
            feature.geometry.type === "Point"
              ? { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }
              : null;
          const popupNode = buildStandPopupContent(
            feature.properties as StandPopupProperties,
            coords,
            {
              isFavorite: (fid) => favoriteIdsRef.current.has(fid),
              onToggle: (fid) => onToggleFavoriteRef.current(fid),
            },
          );
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

  // Re-filter when kategorienFilter, showFavoritesOnly or favoriteIds changes
  // (letzteres auch nach einem Favoriten-Toggle direkt im Kartenpopup).
  useEffect(() => {
    const map = mapRef.current;
    const all = allGeoJSONRef.current;
    if (!map || !all) return;

    const filtered: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: all.features.filter((f) => {
        const cats = (f.properties?.kategorien ?? []) as string[];
        const categoryMatch =
          kategorienFilter.length === 0 || cats.some((k) => kategorienFilter.includes(k));
        const favoriteMatch = !showFavoritesOnly || favoriteIds.has(f.properties?.id as number);
        return categoryMatch && favoriteMatch;
      }),
    };

    const source = map.getSource("stands") as maplibregl.GeoJSONSource | undefined;
    source?.setData(filtered);
  }, [kategorienFilter, showFavoritesOnly, favoriteIds]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
      role="img"
      aria-label="Karte mit Garagenflohmarkt-Ständen in Zirndorf"
    />
  );
}
