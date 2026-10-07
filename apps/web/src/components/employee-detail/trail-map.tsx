'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import { useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Popup, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import { formatInTimeZone } from 'date-fns-tz';
import type { LocationTrailResponse } from '@worktrail/types';
import { trailToGeoJson } from '@/lib/trail-geojson';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
type Picked = { lng: number; lat: number; capturedAt: string; accuracyMeters: number | null; speedMps: number | null; source: string };

export function TrailMap({ trail }: { trail: LocationTrailResponse }) {
  const ref = useRef<MapRef>(null);
  const geo = useMemo(() => trailToGeoJson(trail), [trail]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const time = (iso: string) => formatInTimeZone(new Date(iso), trail.timezone, 'EEE d MMM, h:mm a');

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return setPicked(null);
    const [lng, lat] = (f.geometry as { coordinates: number[] }).coordinates as [number, number];
    setPicked({ lng, lat, ...(f.properties as Omit<Picked, 'lng' | 'lat'>) });
  };

  return (
    <Map
      ref={ref}
      mapStyle={MAP_STYLE}
      initialViewState={
        geo.bounds
          ? { bounds: geo.bounds, fitBoundsOptions: { padding: 48, maxZoom: 16 } }
          : { latitude: 19.076, longitude: 72.8777, zoom: 10 }
      }
      style={{ width: '100%', height: '100%', borderRadius: 12 }}
      interactiveLayerIds={['trail-points']}
      onClick={onClick}
      attributionControl={{ compact: true }}
    >
      <Source id="gaps" type="geojson" data={geo.gaps}>
        <Layer id="trail-gaps" type="line" paint={{ 'line-color': '#A9ACB0', 'line-width': 3, 'line-dasharray': [2, 2] }} />
      </Source>
      <Source id="routes" type="geojson" data={geo.routes}>
        <Layer id="trail-routes" type="line" paint={{ 'line-color': '#FE5A0C', 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
      </Source>
      <Source id="points" type="geojson" data={geo.points}>
        <Layer
          id="trail-points"
          type="circle"
          paint={{
            'circle-radius': 4,
            'circle-color': ['case', ['get', 'approximate'], '#FFFFFF', '#FE5A0C'],
            'circle-stroke-color': ['case', ['get', 'approximate'], '#A9ACB0', '#FFFFFF'],
            'circle-stroke-width': 2,
          }}
        />
      </Source>
      {geo.markers.map((m) => (
        <Marker key={`${m.sessionId}-${m.kind}`} latitude={m.latitude} longitude={m.longitude} anchor="center">
          <span
            role="img"
            aria-label={`${m.kind === 'start' ? 'Start' : 'End'} · ${time(m.time)}`}
            className={`grid size-7 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow ${m.kind === 'start' ? 'bg-success-500' : 'bg-ink-900'}`}
          >
            {m.kind === 'start' ? 'S' : 'E'}
          </span>
        </Marker>
      ))}
      {picked ? (
        <Popup latitude={picked.lat} longitude={picked.lng} onClose={() => setPicked(null)} closeOnClick={false}>
          <div className="space-y-0.5 text-sm">
            <p className="font-semibold">{time(picked.capturedAt)}</p>
            <p>Accuracy: {picked.accuracyMeters != null ? `${Math.round(picked.accuracyMeters)} m` : 'unknown'}</p>
            {picked.speedMps != null ? <p>Speed: {Math.round(picked.speedMps * 3.6)} km/h</p> : null}
            <p className="text-ink-500">
              {picked.source === 'START' ? 'Start work' : picked.source === 'END' ? 'End work' : 'Recorded every 5 minutes'}
            </p>
          </div>
        </Popup>
      ) : null}
    </Map>
  );
}
