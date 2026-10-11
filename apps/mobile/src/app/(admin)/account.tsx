import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useCompanyDay } from '../../admin/use-company';
import { useAuthStore } from '../../auth/auth-store';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { colors, fonts, radius, shadow } from '../../theme/theme';

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { companyName } = useCompanyDay();
  const [busy, setBusy] = useState(false);

  const confirm = () =>
    Alert.alert('Sign out?', 'You will need your email and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        },
      },
    ]);

  return (
    <Screen>
      <Text style={styles.title}>Account</Text>
      <View style={[styles.card, shadow]}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.line}>{user?.email}</Text>
        <Text style={styles.line}>{user?.role === 'OWNER' ? 'Owner' : 'Admin'}</Text>
        {companyName ? <Text style={styles.line}>{companyName}</Text> : null}
      </View>
      <Notice>PDF reports, company settings, data export and deleting an employee are on the Work Trail website.</Notice>
      <Button title="Sign out" variant="secondary" loading={busy} onPress={confirm} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.ink900 },
  line: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
});
