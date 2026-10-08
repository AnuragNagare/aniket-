import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AI_LABEL } from '@worktrail/types';
import { useAuthStore } from '../../auth/auth-store';
import { useMe } from '../../auth/use-me';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { useWorkSession } from '../../sessions/use-work-session';
import { colors, fonts, radius, shadow } from '../../theme/theme';

import { format } from 'date-fns';
import { useRequestDeletion } from '../../privacy/use-deletion-request';

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const me = useMe();
  const work = useWorkSession();
  const signOut = useAuthStore((s) => s.signOut);
  const requestDeletion = useRequestDeletion();

  const onSignOut = () => {
    const s = work.session;
    if (!s) return void signOut();
    Alert.alert('You’re still at work', 'End your work session before signing out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End work and sign out',
        style: 'destructive',
        onPress: () => void work.end(s.id).then(() => signOut()),
      },
    ]);
  };

  const onRequestDeletion = () => {
    Alert.alert(
      'Delete personal data',
      'Are you sure you want to ask your company to delete all your tracked data and personal account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await requestDeletion.mutateAsync();
              const createdDate = new Date(res.createdAt);
              const isOld = Date.now() - createdDate.getTime() > 10000;
              if (isOld) {
                Alert.alert(
                  'Deletion request',
                  `You already asked on ${format(createdDate, 'd MMM')}.`,
                );
              } else {
                Alert.alert('Request sent', 'Your company will contact you.');
              }
            } catch {
              Alert.alert('Error', 'Unable to submit deletion request. Try again later.');
            }
          },
        },
      ],
    );
  };

  const m = me.data;
  return (
    <Screen>
      <Text accessibilityRole="link" style={styles.back} onPress={() => router.back()}>
        Back
      </Text>
      <Text style={styles.title}>{m?.user.name ?? 'Profile'}</Text>
      <View style={[styles.card, shadow]}>
        <Row label="Email" value={m?.user.email} />
        <Row label="Designation" value={m?.employee?.designation} />
        <Row label="Employee ID" value={m?.employee?.employeeCode} />
        <Row label="Company" value={m?.company.name} />
      </View>
      <Notice>
        Your location is recorded only when you start and end work, and only your company’s admins
        can see it.
      </Notice>
      <Notice>
        {AI_LABEL}
      </Notice>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Privacy & Data</Text>
        <Text style={styles.privacySubtitle}>
          You can request permanent erasure of your work trails and account at any time.
        </Text>
        <Button
          title="Ask my company to delete my data"
          variant="secondary"
          loading={requestDeletion.isPending}
          onPress={onRequestDeletion}
        />
      </View>

      <Button title="Sign out" variant="secondary" loading={work.ending} onPress={onSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 14 },
  row: { gap: 2 },
  label: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500 },
  value: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink900 },
  privacyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 20,
    gap: 8,
  },
  privacyTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink900 },
  privacySubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, marginBottom: 6 },
});
