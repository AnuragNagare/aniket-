import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts } from '../theme/theme';

/** Big round microphone button: orange when idle, solid red-orange ring while listening. */
export function MicButton({ listening, disabled, onPress }: { listening: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : 'Speak your update'}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.button, listening && styles.listening, disabled && styles.disabled]}
      >
        <Svg width={30} height={30} viewBox="0 0 24 24">
          <Rect x={9} y={3} width={6} height={12} rx={3} fill="#fff" />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
      </Pressable>
      <Text style={styles.label}>{listening ? 'Listening… tap to stop' : 'Tap to speak'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  button: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand500, alignItems: 'center', justifyContent: 'center' },
  listening: { borderWidth: 6, borderColor: colors.brand200, backgroundColor: '#E84A00' },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink500 },
});
