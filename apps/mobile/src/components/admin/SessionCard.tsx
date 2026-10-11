import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { sessionLabel, type AdminSessionDto } from '@worktrail/types';
import { dateTimeIn, formatMinutes, timeIn } from '../../admin/format';
import { useCloseSession } from '../../admin/hooks';
import { ApiError } from '../../api/client';
import { colors, fonts, radius } from '../../theme/theme';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { Notice } from '../Notice';

type Props = {
  session: AdminSessionDto;
  timezone: string;
  employeeId: string;
  employeeName?: string;
  onClosed?: () => void;
};

type Choice = 'last' | 'now';

/** One work session. An open session can be closed by an admin: at the last location time, or now. The server audits it. */
export function SessionCard({ session: s, timezone, employeeId, employeeName, onClosed }: Props) {
  const close = useCloseSession();
  const [closing, setClosing] = useState(false);
  const [choice, setChoice] = useState<Choice>(s.lastLocationAt ? 'last' : 'now');
  const [error, setError] = useState<string | null>(null);
  const label = sessionLabel(s);
  const minutes = s.totalMinutes ?? Math.max(0, Math.round((Date.now() - Date.parse(s.startedAt)) / 60_000));

  const confirm = async () => {
    setError(null);
    const endedAt = choice === 'last' && s.lastLocationAt ? s.lastLocationAt : new Date().toISOString();
    try {
      await close.mutateAsync({ employeeId, sessionId: s.id, endedAt });
      setClosing(false);
      onClosed?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {employeeName ? <Text style={styles.name}>{employeeName}</Text> : <View />}
        <Text style={[styles.label, label === 'Active' && styles.ok, label === 'Left running' && styles.warn]}>{label}</Text>
      </View>
      <Text style={styles.line}>{dateTimeIn(s.startedAt, timezone)}</Text>
      <Text style={styles.sub}>{s.endedAt ? `Ended ${timeIn(s.endedAt, timezone)}` : 'Still open'}</Text>
      <View style={styles.top}>
        <Text style={styles.duration}>{formatMinutes(minutes)}</Text>
        <Text style={styles.sub}>{`${s.pointCount} locations`}</Text>
      </View>

      {s.status === 'ACTIVE' && !closing ? (
        <Button title="Close session" variant="secondary" onPress={() => setClosing(true)} />
      ) : null}

      {closing ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>End this session at</Text>
          <View style={styles.choices}>
            {s.lastLocationAt ? (
              <Chip label={`Last location (${timeIn(s.lastLocationAt, timezone)})`} selected={choice === 'last'} onPress={() => setChoice('last')} />
            ) : null}
            <Chip label="Now" selected={choice === 'now'} onPress={() => setChoice('now')} />
          </View>
          <Text style={styles.sub}>It will be marked "Closed by admin" and recorded in the audit log.</Text>
          {error ? <Notice tone="warning">{error}</Notice> : null}
          <Button title="Confirm close" loading={close.isPending} onPress={() => void confirm()} />
          <Button title="Cancel" variant="secondary" onPress={() => setClosing(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink900 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink500 },
  ok: { color: colors.success500 },
  warn: { color: colors.brand700 },
  line: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500 },
  duration: { fontFamily: fonts.display, fontSize: 22, color: colors.ink900 },
  panel: { gap: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  panelTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink900 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
