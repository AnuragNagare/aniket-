import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';
import { useAuthStore } from '../../auth/auth-store';
import { useMe } from '../../auth/use-me';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { LastCrashNotice } from '../../components/LastCrashNotice';
import { Screen } from '../../components/Screen';
import { StatusPill } from '../../components/StatusPill';
import { TrackingStatus, TRACKING_STATUS_KEY } from '../../components/TrackingStatus';
import { useNow } from '../../hooks/use-now';
import {
  dayTimeLabel,
  elapsedMs,
  formatElapsed,
  isStale,
  timeLabel,
} from '../../sessions/session-logic';
import {
  ConsentRequiredError,
  LocationOffError,
  NeedsPermissionError,
  useWorkSession,
} from '../../sessions/use-work-session';
import {
  dismissBatteryTip,
  batteryStepsFor,
  openBatterySettings,
  shouldShowBatteryTip,
} from '../../tracking/battery';
import { getOutbox } from '../../tracking/store';
import { colors, fonts, radius, shadow } from '../../theme/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { note } = useLocalSearchParams<{ note?: string }>();
  const qc = useQueryClient();
  const firstName = useAuthStore((s) => s.user?.name.split(' ')[0] ?? '');
  const me = useMe();
  const TZ = me.data?.company.timezone ?? 'Asia/Kolkata';
  const work = useWorkSession();
  const now = useNow(1000);
  const [message, setMessage] = useState<string | null>(null);
  const [keepWorking, setKeepWorking] = useState(false);
  const [showBatteryTip, setShowBatteryTip] = useState(false);
  const brandTip = batteryStepsFor(Device.manufacturer);

  useEffect(() => {
    if (work.session && work.lastStartMode === 'background') {
      void shouldShowBatteryTip().then((show) => {
        if (show) setShowBatteryTip(true);
      });
    }
    if (work.session && work.lastStartMode === 'startEndOnly') {
      void (async () => {
        const box = await getOutbox();
        const asked = await box.getMeta('askedBackground');
        if (!asked) {
          await box.setMeta('askedBackground', '1');
          router.push('/permissions?step=background');
        }
      })();
    }
  }, [work.session, work.lastStartMode, router]);

  const startWork = async () => {
    setMessage(null);
    try {
      await work.start();
      void qc.invalidateQueries({ queryKey: TRACKING_STATUS_KEY });
    } catch (e) {
      if (e instanceof ConsentRequiredError) return router.push('/permissions?step=notice');
      if (e instanceof NeedsPermissionError) return router.push('/permissions');
      if (e instanceof LocationOffError)
        return setMessage('Turn on location (GPS) on your phone, then tap Start work again.');
      setMessage(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  };

  const endWork = (sessionId: string) =>
    Alert.alert('End work?', 'Your work time stops now and your end location is recorded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End work',
        style: 'destructive',
        onPress: () =>
          void work
            .end(sessionId)
            .then(() => qc.invalidateQueries({ queryKey: TRACKING_STATUS_KEY }))
            .catch((e: Error) => setMessage(e.message)),
      },
    ]);

  const header = (
    <View style={styles.header}>
      <Logo />
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="History"
          onPress={() => router.push('/history')}
          hitSlop={10}
        >
          <Text style={styles.profile}>History</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push('/profile')}
          hitSlop={10}
        >
          <Text style={styles.profile}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );

  if (work.isLoading) return <Screen>{header}</Screen>;

  if (work.error && !work.session) {
    return (
      <Screen>
        {header}
        <Notice tone="warning">{work.error.message}</Notice>
        <Button title="Try again" onPress={() => void work.refetch()} />
      </Screen>
    );
  }

  const s = work.session;
  const stale =
    Boolean(s) && !keepWorking && isStale(s!.startedAt, new Date(now + work.offsetMs), TZ);
  return (
    <Screen>
      {header}
      <LastCrashNotice />
      <Text style={styles.greeting}>Hi {firstName}</Text>

      {s ? (
        <View style={[styles.card, shadow]}>
          <StatusPill tone="working" label="At work" />
          <Text accessibilityLabel="Time at work" style={styles.timer}>
            {formatElapsed(elapsedMs(s.startedAt, work.offsetMs, now))}
          </Text>
          <Text style={styles.meta}>Started at {timeLabel(s.startedAt, TZ)}</Text>
          <Text style={styles.meta}>
            {s.lastLocationAt
              ? `Location recorded at ${timeLabel(s.lastLocationAt, TZ)}`
              : 'Start location wasn’t recorded'}
          </Text>
          <TrackingStatus timezone={TZ} />
          {stale ? (
            <Notice tone="warning">
              You started work on {dayTimeLabel(s.startedAt, TZ)} and haven’t ended it. End it now
              if you forgot.
            </Notice>
          ) : null}
          <Button title="End work" loading={work.ending} onPress={() => endWork(s.id)} />
          <Button title="Add update" variant="secondary" onPress={() => router.push('/update')} />
          {stale ? (
            <Button
              title="Keep working"
              variant="secondary"
              onPress={() => setKeepWorking(true)}
            />
          ) : null}
          {showBatteryTip ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Notice>
                Some phones stop apps in the background to save battery. To keep your work day recorded, let Work Trail run in the background.
              </Notice>
              {brandTip ? (
                <Notice>
                  {brandTip.brand}: {brandTip.steps}
                </Notice>
              ) : null}
              <Button
                title="Open battery settings"
                variant="secondary"
                onPress={() => {
                  setShowBatteryTip(false);
                  void openBatterySettings().then(dismissBatteryTip);
                }}
              />
              <Text
                accessibilityRole="button"
                style={{
                  fontFamily: fonts.semibold,
                  color: colors.ink500,
                  textAlign: 'center',
                  padding: 4,
                }}
                onPress={() => {
                  setShowBatteryTip(false);
                  void dismissBatteryTip();
                }}
              >
                Not now
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.card, shadow]}>
          <StatusPill tone="off" label="Off duty" />
          {work.pendingEnd ? (
            <Notice>Work ended. We’ll send it to your company when you’re back online.</Notice>
          ) : null}
          <Text style={styles.title}>Ready to start your day?</Text>
          <Text style={styles.body}>
            Your location is recorded only when you start and end work.
          </Text>
          <Text style={styles.body}>Start work to add updates.</Text>
          <Button title="Start work" loading={work.starting} onPress={() => void startWork()} />
          <Text
            accessibilityRole="link"
            style={styles.link}
            onPress={() => router.push('/permissions')}
          >
            How Work Trail uses your location
          </Text>
        </View>
      )}

      {note === 'sent' ? <Notice>Update sent.</Notice> : null}
      {note === 'queued' ? <Notice>Saved. It’ll send when you’re back online.</Notice> : null}
      {work.startNote ? <Notice>{work.startNote}</Notice> : null}
      {message ? <Notice tone="warning">{message}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profile: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  greeting: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink900 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink700 },
  timer: {
    fontFamily: fonts.display,
    fontSize: 56,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
  },
  meta: { fontFamily: fonts.body, fontSize: 15, color: colors.ink500 },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.brand700,
    textAlign: 'center',
    padding: 6,
  },
});
