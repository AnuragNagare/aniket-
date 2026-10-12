import { StyleSheet, Text, View } from 'react-native';
import { useCompanyDay } from '../../admin/use-company';
import { useAuthStore } from '../../auth/auth-store';
import { useConfirmSignOut } from '../../auth/use-confirm-sign-out';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { colors, fonts, radius, shadow } from '../../theme/theme';

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const { companyName } = useCompanyDay();
  const { confirm, busy } = useConfirmSignOut();

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
