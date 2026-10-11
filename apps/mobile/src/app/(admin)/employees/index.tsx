import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EmployeeStatus } from '@worktrail/types';
import { useEmployees, useResendInvite } from '../../../admin/hooks';
import { inviteMessage } from '../../../admin/invite-message';
import { useCompanyDay } from '../../../admin/use-company';
import { useDebounced } from '../../../admin/use-debounced';
import { ApiError } from '../../../api/client';
import { EmployeeRow } from '../../../components/admin/EmployeeRow';
import { QueryGate } from '../../../components/admin/QueryGate';
import { Button } from '../../../components/Button';
import { Chip } from '../../../components/Chip';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { colors, fonts } from '../../../theme/theme';

const FILTERS: Array<{ label: string; value: EmployeeStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Working', value: 'WORKING' },
  { label: 'Off duty', value: 'OFF_DUTY' },
];

export default function EmployeesScreen() {
  const router = useRouter();
  const { companyName } = useCompanyDay();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim());
  const q = useEmployees({ query: query || undefined, status, page });
  const resend = useResendInvite();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const resendLink = async (id: string, name: string) => {
    setResendingId(id);
    try {
      const r = await resend.mutateAsync(id);
      await Share.share({ message: inviteMessage(companyName, name, r.inviteUrl) });
    } catch (e) {
      Alert.alert('Could not send the link', e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setResendingId(null);
    }
  };

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Text style={styles.title}>Employees</Text>
      <Button title="Invite employee" onPress={() => router.push('/employees/invite')} />
      <TextField
        label="Search by name"
        value={search}
        onChangeText={(t) => {
          setSearch(t);
          setPage(1);
        }}
        autoCapitalize="none"
        placeholder="Search"
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
      <QueryGate query={q}>
        {q.data && q.data.items.length === 0 ? (
          <Text style={styles.empty}>{query || status ? 'No employees match.' : 'No employees yet. Tap Invite employee to add the first one.'}</Text>
        ) : (
          q.data?.items.map((e) => (
            <EmployeeRow
              key={e.id}
              employee={e}
              onOpen={() => router.push(`/employees/${e.id}`)}
              onResend={() => void resendLink(e.id, e.name)}
              resending={resendingId === e.id}
            />
          ))
        )}
        {q.data && totalPages > 1 ? (
          <View style={styles.pager}>
            <Button title="Previous" variant="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
            <Text style={styles.pageText}>
              Page {page} of {totalPages}
            </Text>
            <Button title="Next" variant="secondary" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} />
          </View>
        ) : null}
      </QueryGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900 },
  chips: { flexDirection: 'row', gap: 8 },
  empty: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  pager: { gap: 10, alignItems: 'stretch' },
  pageText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink500, textAlign: 'center' },
});
