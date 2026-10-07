import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { timeLabel } from '../sessions/session-logic';
import { getTrackingStatus } from '../tracking/tracking';
import { colors, fonts } from '../theme/theme';
import { Notice } from './Notice';

export const TRACKING_STATUS_KEY = ['tracking', 'status'] as const;

export function TrackingStatus({ timezone }: { timezone: string }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: TRACKING_STATUS_KEY,
    queryFn: async () =>
      (await getTrackingStatus()) ?? {
        mode: 'off' as const,
        pending: 0,
        lastSentAt: null,
        pendingEnd: false,
      },
    refetchInterval: 15_000,
  });
  if (!data || data.mode === 'off') return null;

  if (data.mode === 'startEndOnly') {
    return (
      <Notice tone="warning">
        Background location is off, so only your start and end locations are recorded.{' '}
        <Text
          accessibilityRole="link"
          style={{ fontFamily: fonts.semibold, color: colors.brand700 }}
          onPress={() => router.push('/permissions?step=background')}
        >
          Turn it on
        </Text>
      </Notice>
    );
  }
  if (data.pending > 0) {
    return (
      <Notice>{`${data.pending} location${data.pending === 1 ? '' : 's'} waiting to send. They’ll go when you’re back online.`}</Notice>
    );
  }
  return (
    <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink500 }}>
      {data.lastSentAt
        ? `Location shared every 5 minutes · last sent ${timeLabel(data.lastSentAt, timezone)}`
        : 'Location shared every 5 minutes'}
    </Text>
  );
}
