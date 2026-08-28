import { useState } from "react";
import type { Stand } from "../types";
import { FlohmarktMap } from "./flohmarkt-map";
import { StandListe } from "./stand-liste";

interface Props {
  kategorienFilter: string[];
  zahlungsartenFilter: string[];
  showFavoritesOnly: boolean;
  favoriteIds: Set<number>;
  onToggleFavorite: (id: number) => void;
  stands: Stand[];
  loading: boolean;
}

// Schaltet bei einem Kartenfehler (Style/Kacheln laden nicht) auf die
// Listenansicht um, statt eine kaputte/leere Karte zu zeigen. Bewusst kein
// Live-Fallback auf einen Drittanbieter - siehe flohmarkt-map.tsx.
export function MapOrList({
  kategorienFilter,
  zahlungsartenFilter,
  showFavoritesOnly,
  favoriteIds,
  onToggleFavorite,
  stands,
  loading,
}: Props) {
  const [mapFailed, setMapFailed] = useState(false);

  if (mapFailed) {
    return (
      <div className="p-4">
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Die Kartenansicht ist gerade nicht verfügbar. Hier ist die Liste aller Stände.
        </p>
        <StandListe
          stands={stands}
          loading={loading}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
    );
  }

  return (
    <FlohmarktMap
      kategorienFilter={kategorienFilter}
      zahlungsartenFilter={zahlungsartenFilter}
      showFavoritesOnly={showFavoritesOnly}
      favoriteIds={favoriteIds}
      onToggleFavorite={onToggleFavorite}
      onError={() => setMapFailed(true)}
    />
  );
}
