import * as maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 ist ESM-only: unter Vite muss die Worker-URL einmalig gesetzt
// werden. ?worker&url (nicht ?url) bündelt den Worker samt seinem
// Schwester-Modul selbst-enthalten - liegt danach same-origin unter
// /assets/, passt also zur CSP (worker-src 'self') ohne blob:.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { fetchGeoJSON, reportStand } from "../api";
import { spreadCoincidentPoints } from "../lib/map-declutter";
import { extractOrtsteil } from "../lib/ortsteil";
import { type StandPopupProperties, buildStandPopupContent } from "../lib/stand-popup";

maplibregl.setWorkerUrl(workerUrl);

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
  ortsteilFilter?: string[];
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
  ortsteilFilter = [],
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
        const ortsteilMatch =
          ortsteilFilter.length === 0 ||
          ortsteilFilter.includes(extractOrtsteil((props.adresse as string) ?? "") ?? "");
        const favoriteMatch = !showFavoritesOnly || favoriteIds.has(props.id as number);
        const searchMatch =
          searchQuery === "" ||
          (props.nickname as string)?.toLowerCase().includes(searchQuery) ||
          (props.adresse as string)?.toLowerCase().includes(searchQuery) ||
          (props.beschreibung as string | null)?.toLowerCase().includes(searchQuery) ||
          cats.some((k) => k.toLowerCase().includes(searchQuery)) ||
          zahlungsarten.some((z) => z.toLowerCase().includes(searchQuery));
        return categoryMatch && zahlungsartMatch && ortsteilMatch && favoriteMatch && searchMatch;
      }),
    };

    const source = map.getSource("stands") as maplibregl.GeoJSONSource | undefined;
    source?.setData(withFavoriteFlag(spreadCoincidentPoints(filtered), favoriteIds));
  }, [
    kategorienFilter,
    zahlungsartenFilter,
    ortsteilFilter,
    showFavoritesOnly,
    searchQuery,
    favoriteIds,
    allGeoJSON,
  ]);

  // Vollbild per CSS-Overlay statt Fullscreen API: iOS-Safari (iPhone)
  // unterstützt requestFullscreen nur für Videos, nicht für beliebige
  // Elemente. Der Karten-Container bleibt dasselbe DOM-Element (die Karte
  // wird also nicht neu aufgebaut), nur der Wrapper wird zum Overlay.
  const [fullscreen, setFullscreen] = useState(false);

  // Beendet das Vollbild; über history.back(), wenn beim Öffnen ein Eintrag
  // angelegt wurde - so verschwindet er wieder und die Zurück-Geste des
  // Handys schließt das Vollbild, statt die Seite zu verlassen.
  const closeFullscreen = useCallback(() => {
    if (window.history.state?.kartenVollbild) window.history.back();
    else setFullscreen(false);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // cooperativeGestures (zwei Finger zum Verschieben, siehe Map-Optionen)
    // verhindert im Normalfall das Hängenbleiben beim Scrollen der Seite -
    // im Vollbild gibt es nichts zu scrollen, ein Finger soll reichen.
    if (fullscreen) map.cooperativeGestures.disable();
    else map.cooperativeGestures.enable();
    // Der Container hat seine Größe geändert.
    const frame = requestAnimationFrame(() => map.resize());
    if (!fullscreen) return () => cancelAnimationFrame(frame);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.history.pushState({ kartenVollbild: true }, "");
    const onPopState = () => setFullscreen(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen, closeFullscreen]);

  return (
    <div className={fullscreen ? "fixed inset-0 z-[1000] bg-white" : "relative h-full w-full"}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        role="img"
        aria-label="Karte mit Garagenflohmarkt-Ständen in Zirndorf"
      />
      {/* Unter dem Standort-Button (oben rechts), im Stil der MapLibre-Steuerelemente. */}
      <button
        type="button"
        onClick={() => (fullscreen ? closeFullscreen() : setFullscreen(true))}
        aria-label={fullscreen ? "Vollbild beenden" : "Karte im Vollbild anzeigen"}
        title={fullscreen ? "Vollbild beenden" : "Vollbild"}
        className="absolute top-[49px] right-[10px] z-10 flex h-[29px] w-[29px] items-center justify-center rounded bg-white text-gray-800 shadow-[0_0_0_2px_rgba(0,0,0,0.1)] hover:bg-gray-100"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {fullscreen ? (
            <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          ) : (
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          )}
        </svg>
      </button>
      {fullscreen && (
        <button
          type="button"
          onClick={closeFullscreen}
          className="absolute top-3 left-3 z-10 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-md hover:bg-gray-100"
        >
          ✕ Vollbild beenden
        </button>
      )}
    </div>
  );
}
