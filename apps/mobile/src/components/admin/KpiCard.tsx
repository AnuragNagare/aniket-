import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme/theme';

/** One headline number with a small caption underneath. */
export function KpiCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={[styles.card, shadow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 4 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink500 },
  value: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900 },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
});
