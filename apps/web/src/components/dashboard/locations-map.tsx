'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre';
import type { DashboardResponse } from '@worktrail/types';

// Served from /public by scripts/copy-maplibre-worker.mjs (the bundler breaks the default path).
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

// Free CARTO basemap with English labels; no API key needed.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const MUMBAI = { latitude: 19.076, longitude: 72.8777 };

type Location = DashboardResponse['locations'][number];

/** Map of each employee's last known point. Orange pin = working now, grey = off duty. */
export function LocationsMap({ locations }: { locations: Location[] }) {
  const ref = useRef<MapRef>(null);
  const points = useMemo(() => locations.filter((l) => l.lastPoint), [locations]);

  const fit = () => {
    const map = ref.current;
    if (!map || points.length === 0) return;
    const lats = points.map((p) => p.lastPoint!.latitude);
    const lngs = points.map((p) => p.lastPoint!.longitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 14, duration: 0 },
    );
  };

  // Refit when the data changes (e.g. a different date is picked).
  useEffect(fit, [points]);

  const first = points[0]?.lastPoint ?? MUMBAI;
  return (
    <Map
      ref={ref}
      mapStyle={MAP_STYLE}
      initialViewState={{ latitude: first.latitude, longitude: first.longitude, zoom: 10 }}
      onLoad={fit}
      style={{ width: '100%', height: '100%', borderRadius: 12 }}
      attributionControl={{ compact: true }}
    >
      {points.map((l) => (
        <Marker
          key={l.employeeId}
          latitude={l.lastPoint!.latitude}
          longitude={l.lastPoint!.longitude}
          anchor="bottom"
        >
          <svg width="28" height="36" viewBox="0 0 24 32" role="img" aria-label={l.name}>
            <path
              d="M12 1C6.5 1 2 5.4 2 10.9 2 18 12 27 12 27s10-9 10-16.1C22 5.4 17.5 1 12 1Z"
              fill={l.status === 'WORKING' ? '#FE5A0C' : '#A9ACB0'}
              stroke="#fff"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="11" r="4" fill="#fff" />
          </svg>
        </Marker>
      ))}
    </Map>
  );
}
