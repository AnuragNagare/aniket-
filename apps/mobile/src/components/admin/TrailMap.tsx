import { Component, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { trailToGeoJson, type LocationTrailResponse } from '@worktrail/types';
import { cameraFor, mapsUrl } from '../../admin/map-camera';
import { timeIn } from '../../admin/format';
import { colors, fonts, radius } from '../../theme/theme';

// Same free basemap as the web dashboard: no API key.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const LIST_LIMIT = 30;

// The native map module only exists in a real build. If it is missing (Expo Go, tests), use the list.
type MapLibreModule = typeof import('@maplibre/maplibre-react-native');
let MapLibre: MapLibreModule | null = null;
try {
  MapLibre = require('@maplibre/maplibre-react-native') as MapLibreModule;
} catch {
  MapLibre = null;
}

type Props = { trail: LocationTrailResponse; timezone: string };

/** A plain list of points with "Open in Maps" links. Used when the native map is unavailable or fails. */
export function TrailList({ trail, timezone, note }: Props & { note?: string }) {
  const shown = trail.points.slice(0, LIST_LIMIT);
  return (
    <View style={styles.list}>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {shown.map((p) => (
        <View key={p.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.time}>{timeIn(p.capturedAt, timezone)}</Text>
            <Text style={styles.sub}>
              {p.source === 'START' ? 'Start of work' : p.source === 'END' ? 'End of work' : 'Location'}
              {p.qualityFlag !== 'GOOD' ? ' · approximate' : ''}
            </Text>
          </View>
          <Text accessibilityRole="link" accessibilityLabel={`Open point at ${timeIn(p.capturedAt, timezone)} in Maps`} style={styles.link} onPress={() => void Linking.openURL(mapsUrl(p.latitude, p.longitude))}>
            Open in Maps
          </Text>
        </View>
      ))}
      {trail.points.length > LIST_LIMIT ? <Text style={styles.note}>{`Showing the first ${LIST_LIMIT} of ${trail.points.length} locations.`}</Text> : null}
    </View>
  );
}

/** If the native map throws while drawing, show the list instead of crashing the app. */
class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function TrailMap({ trail, timezone }: Props) {
  if (trail.points.length === 0) {
    return <Text style={styles.note}>No locations were recorded in this period.</Text>;
  }
  const fallback = <TrailList trail={trail} timezone={timezone} note="The map could not be shown, so here are the recorded locations." />;
  if (!MapLibre) return fallback;

  const { Map, Camera, GeoJSONSource, Layer, Marker } = MapLibre;
  const g = trailToGeoJson(trail);
  const camera = cameraFor(g.bounds);

  return (
    <MapBoundary fallback={fallback}>
      <View style={styles.map} accessibilityLabel="Map of the recorded route">
        <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE}>
          <Camera initialViewState={camera} />
          <GeoJSONSource id="trail-gaps" data={g.gaps as never}>
            <Layer id="trail-gaps-line" type="line" paint={{ 'line-color': '#A9ACB0', 'line-width': 3, 'line-dasharray': [2, 2] }} />
          </GeoJSONSource>
          <GeoJSONSource id="trail-routes" data={g.routes as never}>
            <Layer id="trail-routes-line" type="line" paint={{ 'line-color': '#FE5A0C', 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          </GeoJSONSource>
          <GeoJSONSource id="trail-points" data={g.points as never}>
            <Layer
              id="trail-points-dots"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': ['case', ['get', 'approximate'], '#FFFFFF', '#FE5A0C'],
                'circle-stroke-color': ['case', ['get', 'approximate'], '#A9ACB0', '#FFFFFF'],
                'circle-stroke-width': 2,
              }}
            />
          </GeoJSONSource>
          {g.markers.map((m) => (
            <Marker key={`${m.sessionId}-${m.kind}`} id={`${m.sessionId}-${m.kind}`} lngLat={[m.longitude, m.latitude]}>
              <View style={[styles.pin, m.kind === 'end' && styles.pinEnd]}>
                <Text style={styles.pinText}>{m.kind === 'start' ? 'S' : 'E'}</Text>
              </View>
            </Marker>
          ))}
        </Map>
      </View>
      <Text style={styles.legend}>Orange line: route. Hollow dot: approximate location. Dashed line: no location received. S and E: start and end of work.</Text>
    </MapBoundary>
  );
}

const styles = StyleSheet.create({
  map: { height: 380, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.brand50 },
  legend: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, marginTop: 8 },
  note: { fontFamily: fonts.body, fontSize: 15, color: colors.ink500 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colors.line, padding: 12 },
  time: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500 },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.brand700 },
  pin: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.success500, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinEnd: { backgroundColor: colors.ink900 },
  pinText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 12 },
});
