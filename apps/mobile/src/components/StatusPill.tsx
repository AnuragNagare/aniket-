import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';

export function StatusPill({ tone, label }: { tone: 'working' | 'off'; label: string }) {
  const working = tone === 'working';
  return (
    <View
      style={[styles.pill, { backgroundColor: working ? colors.success50 : colors.surface }]}
    >
      <View
        style={[styles.dot, { backgroundColor: working ? colors.success500 : colors.ink300 }]}
      />
      <Text style={[styles.text, { color: working ? colors.success500 : colors.ink500 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: fonts.semibold, fontSize: 14 },
});
