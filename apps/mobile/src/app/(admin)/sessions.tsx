import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { presetRange } from '@worktrail/types';
import { useWorkSessions } from '../../admin/hooks';
import { useCompanyDay } from '../../admin/use-company';
import { useDebounced } from '../../admin/use-debounced';
import { Pager } from '../../components/admin/Pager';
import { PeriodChips, type AppPreset } from '../../components/admin/PeriodChips';
import { QueryGate } from '../../components/admin/QueryGate';
import { SessionCard } from '../../components/admin/SessionCard';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, fonts } from '../../theme/theme';

const FILTERS: Array<{ label: string; value: string | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Left running', value: 'LEFT_RUNNING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Closed by admin', value: 'CLOSED' },
];

export default function SessionsScreen() {
  const { today } = useCompanyDay();
  const [preset, setPreset] = useState<AppPreset>('today');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim());
  const range = presetRange(preset, today);
  const q = useWorkSessions({ ...range, status, query: query || undefined, page });

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Text style={styles.title}>Work sessions</Text>
      <Text style={styles.sub}>Every start and end of work in your company.</Text>
      <PeriodChips
        value={preset}
        onChange={(p) => {
          setPreset(p);
          setPage(1);
        }}
      />
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            selected={f.value === status}
            onPress={() => {
              setStatus(f.value);
              setPage(1);
            }}
          />
        ))}
      </View>
      <TextField
        label="Search by employee"
        value={search}
        onChangeText={(t) => {
          setSearch(t);
          setPage(1);
        }}
        autoCapitalize="none"
        placeholder="Search"
      />
      <QueryGate query={q}>
        {q.data && q.data.items.length === 0 ? <Text style={styles.sub}>No work sessions in this period.</Text> : null}
        {q.data?.items.map((s) => (
          <SessionCard key={s.id} session={s} timezone={q.data!.timezone} employeeId={s.employeeId} employeeName={s.employeeName} />
        ))}
        {q.data ? <Pager page={page} total={q.data.total} pageSize={q.data.pageSize} onChange={setPage} /> : null}
      </QueryGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.ink500 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
