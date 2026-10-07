import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UPDATE_CATEGORY_LABELS } from '@worktrail/types';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { timeLabel } from '../../sessions/session-logic';
import { useHistory } from '../../updates/use-history';
import { colors, fonts, radius, shadow } from '../../theme/theme';

const TZ = 'Asia/Kolkata';
const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export default function HistoryScreen() {
  const router = useRouter();
  const history = useHistory(14);

  return (
    <Screen>
      <Text accessibilityRole="link" style={styles.back} onPress={() => router.back()}>
        Back
      </Text>
      <Text style={styles.title}>History</Text>
      <Text style={styles.sub}>Your last 14 days of work.</Text>
      {history.error ? <Notice tone="warning">{(history.error as Error).message}</Notice> : null}
      {history.data && history.data.length === 0 ? (
        <Notice>Nothing yet. Your work sessions and updates will appear here after you start work.</Notice>
      ) : null}
      {history.data?.map((day) => (
        <View key={day.date} style={[styles.card, shadow]}>
          <Text style={styles.day}>{day.label}</Text>
          {day.sessions.map((s) => (
            <Text key={s.id} style={styles.session}>
              {timeLabel(s.startedAt, TZ)} – {s.endedAt ? timeLabel(s.endedAt, TZ) : 'now'} · {duration(s.minutesThatDay)}
            </Text>
          ))}
          {day.updates.map((u) => (
            <View key={u.clientUpdateId} style={styles.update}>
              <Text style={styles.meta}>
                {[
                  timeLabel(u.submittedAt, TZ),
                  u.category ? UPDATE_CATEGORY_LABELS[u.category] : null,
                  u.inputMethod === 'VOICE' ? 'Spoken' : null,
                  u.waiting ? 'Waiting to send' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={styles.text}>{u.text}</Text>
              {!u.waiting ? (
                u.summaryStatus === 'COMPLETE' && u.aiSummary ? (
                  <View style={styles.aiBox}>
                    <Text style={styles.aiBadge}>AI summary</Text>
                    <Text style={styles.aiText}>{u.aiSummary.summary}</Text>
                  </View>
                ) : u.summaryStatus === 'FAILED' ? (
                  <Text style={styles.aiMuted}>Summary unavailable</Text>
                ) : (
                  <Text style={styles.aiMuted}>Summary on the way</Text>
                )
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, gap: 10 },
  day: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink900 },
  session: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink700 },
  update: { gap: 2, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink900 },
  aiBox: {
    marginTop: 4,
    padding: 8,
    borderRadius: radius.card,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
  aiBadge: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.brand700,
    textTransform: 'uppercase',
  },
  aiText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
    color: colors.ink900,
  },
  aiMuted: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink500,
  },
});
