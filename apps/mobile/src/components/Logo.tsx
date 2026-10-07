import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../theme/theme';

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const h = size === 'lg' ? 40 : 30;
  return (
    <View accessible accessibilityLabel="Work Trail" accessibilityRole="image" style={styles.row}>
      <Svg width={h * 0.75} height={h} viewBox="0 0 24 32">
        <Path
          d="M12 1C6.5 1 2 5.4 2 10.9 2 18 12 27 12 27s10-9 10-16.1C22 5.4 17.5 1 12 1Z"
          fill={colors.brand500}
        />
        <Circle cx={12} cy={11} r={4} fill="#fff" />
        <Path
          d="M4 30c4-3 12 1 16-2"
          stroke={colors.brand500}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      <Text
        style={[styles.word, { fontSize: size === 'lg' ? 40 : 26 }]}
        importantForAccessibility="no"
      >
        <Text style={{ color: colors.ink900 }}>Work </Text>
        <Text style={{ color: colors.brand500 }}>Trail</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontFamily: fonts.display, letterSpacing: -0.3 },
});
