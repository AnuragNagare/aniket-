import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EmployeeListItem } from '@worktrail/types';
import { initials } from '../../admin/format';
import { colors, fonts, radius } from '../../theme/theme';
import { StatusPill } from '../StatusPill';

type Props = { employee: EmployeeListItem; onOpen: () => void; onResend?: () => void; resending?: boolean };

/** One employee in the list. Invited people (no account yet) also get a Resend link button, kept beside the row, not inside it. */
export function EmployeeRow({ employee: e, onOpen, onResend, resending }: Props) {
  const invited = e.account === 'INVITED';
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${e.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(e.name)}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{e.name}</Text>
          <Text style={styles.sub}>{[e.designation, e.employeeCode].filter(Boolean).join(' · ') || e.email || ''}</Text>
          {invited ? null : (
            <StatusPill tone={e.status === 'WORKING' ? 'working' : 'off'} label={e.status === 'WORKING' ? 'Working' : 'Off duty'} />
          )}
        </View>
      </Pressable>
      {invited ? (
        <View style={styles.invited}>
          <Text style={styles.invitedTag}>Invited, not joined yet</Text>
          {onResend ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Resend link to ${e.name}`} disabled={resending} onPress={onResend} hitSlop={8}>
              <Text style={styles.resend}>{resending ? 'Sending...' : 'Resend link'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, color: colors.brand700, fontSize: 16 },
  body: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500 },
  invited: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  invitedTag: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink500 },
  resend: { fontFamily: fonts.semibold, fontSize: 14, color: colors.brand700 },
});
