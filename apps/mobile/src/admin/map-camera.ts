type Bounds = [[number, number], [number, number]] | null;

/** Initial camera for the trail map: fit the points, centre on a lone point, or show India when empty. */
export function cameraFor(bounds: Bounds) {
  if (!bounds) return { center: [78.9629, 20.5937] as [number, number], zoom: 3.5 };
  const [[west, south], [east, north]] = bounds;
  if (west === east && south === north) return { center: [west, south] as [number, number], zoom: 15 };
  return {
    bounds: [west, south, east, north] as [number, number, number, number],
    padding: { top: 48, right: 48, bottom: 48, left: 48 },
  };
}

/** Link that opens one coordinate in whatever maps app the phone has. */
export const mapsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
