import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { presetRange, type DateRange } from '@worktrail/types';
import {
  useEmployee,
  useEmployeeSessions,
  useEmployeeSummary,
  useEmployeeTrail,
  useEmployeeUpdates,
} from '../../../admin/hooks';
import { dateTimeIn, formatMinutes } from '../../../admin/format';
import { useCompanyDay } from '../../../admin/use-company';
import { KpiCard } from '../../../components/admin/KpiCard';
import { Pager } from '../../../components/admin/Pager';
import { PeriodChips, type AppPreset } from '../../../components/admin/PeriodChips';
import { QueryGate } from '../../../components/admin/QueryGate';
import { SessionCard } from '../../../components/admin/SessionCard';
import { TrailMap } from '../../../components/admin/TrailMap';
import { UpdateItem } from '../../../components/admin/UpdateItem';
import { Chip } from '../../../components/Chip';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { StatusPill } from '../../../components/StatusPill';
import { colors, fonts } from '../../../theme/theme';

const TABS = ['Overview', 'Updates', 'Hours', 'Map'] as const;
type Tab = (typeof TABS)[number];
type TabProps = { id: string; range: DateRange; tz: string };

function OverviewTab({ id, range, tz }: TabProps) {
  const q = useEmployeeSummary(id, range);
  const s = q.data;
  return (
    <QueryGate query={q}>
      {s ? (
        <>
          {s.leftRunning ? <Notice tone="warning">A work session is still open. Check the Hours tab to close it if it was forgotten.</Notice> : null}
          <View style={styles.kpis}>
            <KpiCard label="Time worked" value={formatMinutes(s.totalMinutes)} caption={`${s.daysWorked} day${s.daysWorked === 1 ? '' : 's'} worked`} />
            <KpiCard label="Updates" value={String(s.updateCount)} />
            <KpiCard label="Distance" value={`${s.distanceKm} km`} caption="Estimate from recorded locations" />
            <KpiCard label="Locations" value={String(s.pointCount)} />
          </View>
          <Text style={styles.sub}>{s.lastSeenAt ? `Last location ${dateTimeIn(s.lastSeenAt, tz)}` : 'No location recorded yet'}</Text>
        </>
      ) : null}
    </QueryGate>
  );
}

function UpdatesTab({ id, range, tz }: TabProps) {
  const [page, setPage] = useState(1);
  const q = useEmployeeUpdates(id, range, page);
  return (
    <QueryGate query={q}>
      {q.data && q.data.items.length === 0 ? <Text style={styles.sub}>No updates in this period.</Text> : null}
      {q.data?.items.map((u) => (
        <UpdateItem
          key={u.id}
          text={u.text}
          submittedAt={u.submittedAt}
          timezone={tz}
          category={u.category}
          voice={u.inputMethod === 'VOICE'}
          summary={u.summaryStatus === 'COMPLETE' ? (u.aiSummary?.summary ?? null) : null}
        />
      ))}
      {q.data ? <Pager page={page} total={q.data.total} pageSize={q.data.pageSize} onChange={setPage} /> : null}
    </QueryGate>
  );
}

function HoursTab({ id, range }: Omit<TabProps, 'tz'>) {
  const q = useEmployeeSessions(id, range);
  return (
    <QueryGate query={q}>
      {q.data ? (
        <>
          <Text style={styles.total}>{`Total ${formatMinutes(q.data.totalMinutes)}`}</Text>
          {q.data.days
            .filter((d) => d.minutes > 0)
            .map((d) => (
              <View key={d.date} style={styles.day}>
                <Text style={styles.dayDate}>{d.date}</Text>
                <Text style={styles.dayMin}>{formatMinutes(d.minutes)}</Text>
              </View>
            ))}
          {q.data.sessions.length === 0 ? <Text style={styles.sub}>No work sessions in this period.</Text> : null}
          {q.data.sessions.map((s) => (
            <SessionCard key={s.id} session={s} timezone={q.data!.timezone} employeeId={id} />
          ))}
        </>
      ) : null}
    </QueryGate>
  );
}

function MapTab({ id, range, tz }: TabProps) {
  const q = useEmployeeTrail(id, range);
  const t = q.data;
  return (
    <QueryGate query={q}>
      {t ? (
        <>
          <Text style={styles.sub}>{`${t.stats.pointCount} locations · ${t.stats.distanceKm} km${t.stats.lowAccuracyCount ? ` · ${t.stats.lowAccuracyCount} approximate` : ''}`}</Text>
          {t.truncated ? <Notice>Showing the first 5,000 locations.</Notice> : null}
          {t.stats.gapCount ? <Text style={styles.sub}>{`${t.stats.gapCount} gap${t.stats.gapCount === 1 ? '' : 's'} with no location received`}</Text> : null}
          <TrailMap trail={t} timezone={tz} />
        </>
      ) : null}
    </QueryGate>
  );
}

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tz, today } = useCompanyDay();
  const [preset, setPreset] = useState<AppPreset>('today');
  const [tab, setTab] = useState<Tab>('Overview');
  const range = presetRange(preset, today);
  const q = useEmployee(id);
  const e = q.data;

  return (
    <Screen>
      <Text accessibilityRole="link" style={styles.back} onPress={() => router.back()}>
        Back to employees
      </Text>
      <QueryGate query={q}>
        {e ? (
          <>
            <View style={{ gap: 4 }}>
              <Text style={styles.title}>{e.name}</Text>
              {e.designation ? <Text style={styles.sub}>{e.designation}</Text> : null}
              {e.account === 'INVITED' ? (
                <Text style={styles.sub}>Invited, not joined yet</Text>
              ) : (
                <StatusPill tone={e.status === 'WORKING' ? 'working' : 'off'} label={e.status === 'WORKING' ? 'Working' : 'Off duty'} />
              )}
            </View>
            {e.deactivated ? <Notice tone="warning">This account is deactivated.</Notice> : null}
            <PeriodChips value={preset} onChange={setPreset} />
            <View style={styles.tabs}>
              {TABS.map((t) => (
                <Chip key={t} label={t} selected={t === tab} onPress={() => setTab(t)} />
              ))}
            </View>
            {tab === 'Overview' ? <OverviewTab id={id} range={range} tz={tz} /> : null}
            {tab === 'Updates' ? <UpdatesTab id={id} range={range} tz={tz} /> : null}
            {tab === 'Hours' ? <HoursTab id={id} range={range} /> : null}
            {tab === 'Map' ? <MapTab id={id} range={range} tz={tz} /> : null}
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.ink500 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  total: { fontFamily: fonts.display, fontSize: 24, color: colors.ink900 },
  day: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  dayDate: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink700 },
  dayMin: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink900 },
});
