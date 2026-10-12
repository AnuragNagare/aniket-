import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme/theme';

type Props = { label: string; value: string; caption?: string; onPress?: () => void };

/** One headline number with a small caption underneath. Tappable when `onPress` is given. */
export function KpiCard({ label, value, caption, onPress }: Props) {
  const body = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label}: ${value}`} style={[styles.card, shadow]}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadow, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 4 },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink500 },
  value: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900 },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
});
