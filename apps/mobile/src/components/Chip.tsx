import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/theme';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.on : styles.off]}
    >
      <Text style={[styles.text, { color: selected ? colors.brand700 : colors.ink700 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  on: { backgroundColor: colors.brand100, borderColor: colors.brand200 },
  off: { backgroundColor: colors.surface, borderColor: colors.line },
  text: { fontFamily: fonts.medium, fontSize: 15 },
});
