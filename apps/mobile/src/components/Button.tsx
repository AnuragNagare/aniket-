import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, ctaGradient, fonts, radius } from '../theme/theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: Props) {
  const isDisabled = Boolean(disabled || loading);
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        !primary && styles.secondary,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {primary ? (
        <LinearGradient
          colors={ctaGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : colors.brand700} />
      ) : (
        <Text style={[styles.label, !primary && styles.labelSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.input,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand200 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.9 },
  label: { color: '#fff', fontFamily: fonts.semibold, fontSize: 17 },
  labelSecondary: { color: colors.brand700 },
});
