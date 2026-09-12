import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchGeoJSON, reportStand } from "../api";
import { spreadCoincidentPoints } from "../lib/map-declutter";
import { type StandPopupProperties, buildStandPopupContent } from "../lib/stand-popup";

// Zirndorf Zentrum
const CENTER: [number, number] = [10.9557, 49.4467];
const ZOOM = 13;

// Setzt isFavorite pro Feature neu, statt die Original-Objekte aus
// allGeoJSON zu mutieren (die werden auch beim nächsten Filterdurchlauf
// wiederverwendet). MapLibre liest diese Eigenschaft über die
// circle-color-Paint-Expression (siehe map.addLayer unten).
function withFavoriteFlag(
  collection: GeoJSON.FeatureCollection,
  favoriteIds: Set<number>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((f) => ({
      ...f,
      properties: { ...f.properties, isFavorite: favoriteIds.has(f.properties?.id as number) },
    })),
  };
}

interface Props {
  kategorienFilter?: string[];
  zahlungsartenFilter?: string[];
  showFavoritesOnly?: boolean;
  // Bereits getrimmt+lowercased vom Aufrufer (siehe flohmarkt-app.tsx) -
  // hier nur noch ein einfacher includes()-Vergleich nötig.
  searchQuery?: string;
  favoriteIds: Set<number>;
  onToggleFavorite: (id: number) => void;
  onError?: () => void;
}

export function FlohmarktMap({
  kategorienFilter = [],
  zahlungsartenFilter = [],
  showFavoritesOnly = false,
  searchQuery = "",
  favoriteIds,
  onToggleFavorite,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // State statt Ref: das anfängliche Laden ist async (map.on("load", ...)),
  // ein Ref-Write allein löst den Filter-Effekt unten nicht erneut aus - der
  // lief dann schon (mit allGeoJSON noch null) und ohne einen State-Trigger
  // nie wieder, sodass initial gesetzte Filter (z.B. übers Teilen eines
  // einzelnen Stands, siehe lib/share.ts) auf der Karte ignoriert wurden.
  const [allGeoJSON, setAllGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
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
      // Ohne das fängt die Karte jedes Scrollen/Wischen über ihrer Fläche ab
      // (Mausrad zoomt, Ein-Finger-Wisch verschiebt die Karte) - beim
      // Herunterscrollen zur Standliste bleibt man dann in der Karte hängen.
      // Mit cooperativeGestures braucht Zoomen per Mausrad Strg/⌘, Verschieben
      // auf Touch zwei Finger - ein Finger/normales Scrollen geht ganz normal
      // an der Karte vorbei zur Seite darunter durch.
      cooperativeGestures: true,
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText":
          "Strg gedrückt halten und scrollen, um die Karte zu zoomen",
        "CooperativeGesturesHandler.MacHelpText":
          "⌘ gedrückt halten und scrollen, um die Karte zu zoomen",
        "CooperativeGesturesHandler.MobileHelpText": "Mit zwei Fingern die Karte verschieben",
      },
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
        setAllGeoJSON(geojson);
        // isFavorite schon hier setzen (mit dem zum Ladezeitpunkt aktuellen
        // Stand, siehe favoriteIdsRef) statt auf den Filter-Effekt unten zu
        // warten - sonst blitzen eigene Favoriten beim ersten Laden kurz
        // grün auf, bevor sie gelb werden. Ebenso schon hier den Versatz für
        // deckungsgleiche Adressen anwenden, siehe spreadCoincidentPoints.
        const initialData = withFavoriteFlag(
          spreadCoincidentPoints(geojson),
          favoriteIdsRef.current,
        );
        // cluster: true fasst nahe beieinanderliegende Punkte beim
        // Rauszoomen zu einem Punkt mit Zähler zusammen (Supercluster,
        // in MapLibre eingebaut) - ohne das ballen sich bei der
        // Zirndorf-weiten Startansicht viele Stände nahe der Kernstadt zu
        // einem unübersichtlichen Klumpen einzelner Kreise. clusterRadius
        // in Pixern, nicht Metern - wirkt also bei jedem Zoom gleich stark,
        // unabhängig vom spreadCoincidentPoints()-Versatz oben (der wirkt
        // in Grad/Metern und wird bei niedrigem Zoom von clusterRadius
        // ohnehin überstimmt - beide Mechanismen ergänzen sich: Clustering
        // fürs allgemeine Rauszoomen, der Versatz fürs Auseinanderhalten,
        // sobald ein Cluster sich in Einzelpunkte auflöst).
        map.addSource("stands", {
          type: "geojson",
          data: initialData,
          cluster: true,
          clusterMaxZoom: 15,
          clusterRadius: 50,
        });

        // Cluster-Kreise: Größe/Farbe in drei Stufen nach point_count,
        // dieselbe Grün-Familie wie die Einzelpunkte statt einer fremden
        // Farbe.
        map.addLayer({
          id: "stands-clusters",
          type: "circle",
          source: "stands",
          filter: ["has", "point_count"],
          paint: {
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 25, 26],
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#009A00",
              10,
              "#007a00",
              25,
              "#005c00",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
        map.addLayer({
          id: "stands-cluster-count",
          type: "symbol",
          source: "stands",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 13,
          },
          paint: { "text-color": "#fff" },
        });

        map.addLayer({
          id: "stands-pins",
          type: "circle",
          source: "stands",
          // Wenn nicht (mehr) Teil eines Clusters - siehe stands-clusters
          // oben, die dieselbe Source für zusammengefasste Punkte nutzt.
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 10,
            // Eigene Favoriten (siehe favoriteIds-Prop, per localStorage in
            // flohmarkt-app.tsx) gelb statt grün - Farbe kommt aus der
            // isFavorite-Eigenschaft, die withFavoriteFlag() pro Feature
            // setzt (favoriteIds selbst ist Laufzeit-Zustand, keine
            // GeoJSON-Eigenschaft, kann MapLibre also nicht direkt lesen).
            "circle-color": [
              "case",
              ["boolean", ["get", "isFavorite"], false],
              "#facc15",
              "#009A00",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });

        // Klick auf einen Cluster zoomt genau so weit rein, bis er sich in
        // Einzelpunkte auflöst (von Supercluster vorberechnet, kein Raten
        // nötig) statt einer festen Zoomstufe.
        map.on("click", "stands-clusters", async (e) => {
          const feature = e.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          const clusterId = feature.properties?.cluster_id as number;
          const source = map.getSource("stands") as maplibregl.GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
        });
        map.on("mouseenter", "stands-clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "stands-clusters", () => {
          map.getCanvas().style.cursor = "";
        });

        // Zeigt initial alle angemeldeten Stände, nicht nur CENTER/ZOOM
        // (Zirndorfer Kernstadt) - Stände in Außenorten (weiter vom
        // Zentrum, aber weiterhin innerhalb der zulässigen PLZ 90513,
        // siehe _reject_if_outside_zirndorf in app/routes/stands.py) waren
        // sonst erst nach manuellem Rauszoomen sichtbar. Bewusst aus den
        // echten Standdaten berechnet statt einer fest eingetragenen
        // Zirndorf-Gemeindegrenze - passt sich automatisch an, sobald
        // irgendwo (auch in einem bisher leeren Ortsteil) ein Stand dazu
        // kommt, ohne dass hier Koordinaten gepflegt werden müssten. Bei
        // 0 oder nur einem Stand bleibt es faktisch bei CENTER/ZOOM
        // (maxZoom verhindert sinnloses Heranzoomen auf einen einzelnen
        // Punkt), duration: 0 vermeidet eine sichtbare Schwenk-Animation
        // direkt nach dem ersten Laden.
        const bounds = new maplibregl.LngLatBounds();
        for (const f of initialData.features) {
          if (f.geometry.type === "Point") {
            bounds.extend(f.geometry.coordinates as [number, number]);
          }
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 50, maxZoom: ZOOM, duration: 0 });
        }
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
            { onReport: (fid, grund) => reportStand(fid, grund) },
          );
          // Default-maxWidth (240px) reicht für Navigieren/Favoriten/Melden
          // nebeneinander nicht - die Buttons quetschten sich dann ineinander
          // (siehe buildStandPopupContent, das die Zeile zusätzlich umbrechen
          // lässt, falls es trotzdem mal eng wird).
          new maplibregl.Popup({ maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setDOMContent(popupNode)
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

  // Re-filter when kategorienFilter, zahlungsartenFilter, showFavoritesOnly,
  // searchQuery oder favoriteIds sich ändert (letzteres auch nach einem
  // Favoriten-Toggle direkt im Kartenpopup).
  useEffect(() => {
    const map = mapRef.current;
    const all = allGeoJSON;
    if (!map || !all) return;

    const filtered: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: all.features.filter((f) => {
        const props = f.properties ?? {};
        const cats = (props.kategorien ?? []) as string[];
        const zahlungsarten = (props.zahlungsarten ?? []) as string[];
        const categoryMatch =
          kategorienFilter.length === 0 || cats.some((k) => kategorienFilter.includes(k));
        const zahlungsartMatch =
          zahlungsartenFilter.length === 0 ||
          zahlungsarten.some((z) => zahlungsartenFilter.includes(z));
        const favoriteMatch = !showFavoritesOnly || favoriteIds.has(props.id as number);
        const searchMatch =
          searchQuery === "" ||
          (props.nickname as string)?.toLowerCase().includes(searchQuery) ||
          (props.adresse as string)?.toLowerCase().includes(searchQuery) ||
          (props.beschreibung as string | null)?.toLowerCase().includes(searchQuery) ||
          cats.some((k) => k.toLowerCase().includes(searchQuery)) ||
          zahlungsarten.some((z) => z.toLowerCase().includes(searchQuery));
        return categoryMatch && zahlungsartMatch && favoriteMatch && searchMatch;
      }),
    };

    const source = map.getSource("stands") as maplibregl.GeoJSONSource | undefined;
    source?.setData(withFavoriteFlag(spreadCoincidentPoints(filtered), favoriteIds));
  }, [
    kategorienFilter,
    zahlungsartenFilter,
    showFavoritesOnly,
    searchQuery,
    favoriteIds,
    allGeoJSON,
  ]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
      role="img"
      aria-label="Karte mit Garagenflohmarkt-Ständen in Zirndorf"
    />
  );
}
