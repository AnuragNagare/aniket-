import { formatInTimeZone } from 'date-fns-tz';
import type { LocationTrailResponse } from '@worktrail/types';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function TrailSummary({ trail }: { trail: LocationTrailResponse }) {
  const { stats, timezone: tz } = trail;
  if (stats.pointCount === 0) return <p className="text-ink-500">No locations recorded in this period.</p>;
  const time = (iso: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');
  return (
    <div className="space-y-2">
      <p className="font-medium text-ink-900">{`${plural(stats.pointCount, 'location')} · ${stats.distanceKm} km · ${plural(stats.gapCount, 'gap')}`}</p>
      {stats.lowAccuracyCount / stats.pointCount > 0.2 ? (
        <p className="text-sm text-ink-700">Some locations are approximate (accuracy worse than 100 m).</p>
      ) : null}
      {trail.truncated ? <p className="text-sm text-ink-700">Showing the first 5,000 locations. Choose a shorter period to see all of them.</p> : null}
      {trail.gaps.length ? (
        <ul className="space-y-1 text-sm text-ink-500">
          {trail.gaps.map((g) => (
            <li key={`${g.sessionId}-${g.from}`}>{`No location for ${g.minutes} min · ${time(g.from)} – ${time(g.to)}`}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
