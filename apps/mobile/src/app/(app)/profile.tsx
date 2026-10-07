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
});
