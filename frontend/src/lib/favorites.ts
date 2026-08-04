import { useCallback, useState } from "react";

// Rein clientseitig (localStorage) - kein Account, kein Server-Sync nötig
// und kein neues Datenschutzthema, da nie etwas an den Server geht.
const FAVORITES_KEY = "flohmarkt_favorites";

function readFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function writeFavorites(ids: Set<number>): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

export function isFavorite(id: number): boolean {
  return readFavorites().has(id);
}

export function toggleFavoriteId(id: number): void {
  const favorites = readFavorites();
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  writeFavorites(favorites);
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => readFavorites());

  const toggleFavorite = useCallback((id: number) => {
    toggleFavoriteId(id);
    setFavoriteIds(readFavorites());
  }, []);

  return { favoriteIds, toggleFavorite };
}
