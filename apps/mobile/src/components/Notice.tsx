import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme/theme';

/** Inline message box. "warning" is announced to screen readers. */
export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning';
  children: React.ReactNode;
}) {
  return (
    <View
      accessibilityRole={tone === 'warning' ? 'alert' : undefined}
      style={[styles.box, tone === 'warning' ? styles.warning : styles.info]}
    >
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.input, padding: 14, borderWidth: 1 },
  info: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  warning: { backgroundColor: '#FFF4F2', borderColor: '#F8C9C0' },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink900 },
});
