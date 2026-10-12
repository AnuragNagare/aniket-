import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDashboard } from '../../admin/hooks';
import { formatMinutes } from '../../admin/format';
import { useCompanyDay } from '../../admin/use-company';
import { useAuthStore } from '../../auth/auth-store';
import { useConfirmSignOut } from '../../auth/use-confirm-sign-out';
import { QueryGate } from '../../components/admin/QueryGate';
import { KpiCard } from '../../components/admin/KpiCard';
import { UpdateItem } from '../../components/admin/UpdateItem';
import { Button } from '../../components/Button';
import { LastCrashNotice } from '../../components/LastCrashNotice';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { colors, fonts } from '../../theme/theme';

/** "2026-10-07" minus one day, without any timezone arithmetic. */
const dayBefore = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function DashboardScreen() {
  const router = useRouter();
  const { confirm: confirmSignOut, busy: signingOut } = useConfirmSignOut();
  const name = useAuthStore((s) => s.user?.name ?? '');
  const { today, companyName } = useCompanyDay();
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const date = day === 'today' ? today : dayBefore(today);
  const q = useDashboard(date);
  const k = q.data?.kpis;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <LastCrashNotice />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Hello, {name.trim().split(/\s+/)[0]}</Text>
          {companyName ? <Text style={styles.sub}>{companyName}</Text> : null}
        </View>
        <Text accessibilityRole="button" accessibilityLabel="Sign out" style={styles.signOut} onPress={signingOut ? undefined : confirmSignOut}>
          Sign out
        </Text>
      </View>
      <Button title="Add employee" onPress={() => router.push('/employees/invite')} />
      <View style={styles.chips}>
        <Chip label="Today" selected={day === 'today'} onPress={() => setDay('today')} />
        <Chip label="Yesterday" selected={day === 'yesterday'} onPress={() => setDay('yesterday')} />
      </View>
      <QueryGate query={q}>
        {q.data && k ? (
          <>
            <View style={styles.kpis}>
              <KpiCard label="Total employees" value={String(k.totalEmployees)} onPress={() => router.push('/employees')} />
              <KpiCard label="Working now" value={String(k.workingNow)} caption={`${k.checkedInToday} checked in`} onPress={() => router.push({ pathname: '/employees', params: { status: 'WORKING' } })} />
              <KpiCard label="Hours today" value={formatMinutes(k.workMinutesToday)} caption={`Yesterday ${formatMinutes(k.workMinutesYesterday)}`} onPress={() => router.push('/sessions')} />
              <KpiCard label="Updates today" value={String(k.updatesToday)} caption={`Yesterday ${k.updatesYesterday}`} onPress={() => router.push('/employees')} />
            </View>
            {k.totalEmployees === 0 ? <Text style={styles.empty}>No employees yet. Tap Add employee to send the first invite link.</Text> : null}
            <Text style={styles.section}>Recent updates</Text>
            {q.data.recentUpdates.length === 0 ? (
              <Text style={styles.empty}>No updates for this day yet.</Text>
            ) : (
              q.data.recentUpdates.map((u) => (
                <UpdateItem
                  key={u.id}
                  who={u.employeeName}
                  text={u.text}
                  submittedAt={u.submittedAt}
                  timezone={q.data!.timezone}
                  category={u.category}
                  voice={u.inputMethod === 'VOICE'}
                  summary={u.summary}
                />
              ))
            )}
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1 },
  signOut: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700, paddingVertical: 8 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  chips: { flexDirection: 'row', gap: 8 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  section: { fontFamily: fonts.display, fontSize: 22, color: colors.ink900, marginTop: 8 },
  empty: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
});
