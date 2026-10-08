import { formatInTimeZone } from 'date-fns-tz';

export function ConsentLine({
  consentedAt,
  timezone = 'Asia/Kolkata',
}: {
  consentedAt: string | null;
  timezone?: string;
}) {
  if (!consentedAt) {
    return (
      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block">
        Has not agreed to tracking yet
      </span>
    );
  }

  const dateStr = formatInTimeZone(new Date(consentedAt), timezone, 'd MMM yyyy');
  return (
    <span className="text-xs text-ink-500">
      Agreed to tracking on {dateStr}
    </span>
  );
}
