import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { colors, fonts, radius, shadow } from '../../theme/theme';

const TILES = ['Record work sessions', 'Submit quick updates', 'Get clear reports'];

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="link" onPress={() => router.push('/login')} style={styles.skip}>
          Skip
        </Text>
      </View>
      <View style={styles.hero}>
        <Logo size="lg" />
        <Text style={styles.tagline}>
          Track work. Share updates.{'\n'}Get clear reports.
        </Text>
      </View>
      <Image
        source={require('../../../assets/welcome-trail.png')}
        style={styles.art}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible={false}
      />
      <View style={[styles.tiles, shadow]}>
        {TILES.map((t) => (
          <Text key={t} style={styles.tile}>
            {t}
          </Text>
        ))}
      </View>
      <Button title="Get started" onPress={() => router.push('/join')} />
      <Button title="Sign in" variant="secondary" onPress={() => router.push('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-end' },
  skip: { fontFamily: fonts.semibold, color: colors.brand700, fontSize: 16, padding: 4 },
  hero: { alignItems: 'center', gap: 10 },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink500,
    textAlign: 'center',
  },
  art: { width: '100%', height: 260 },
  tiles: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 14,
  },
  tile: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
    color: colors.ink900,
    paddingHorizontal: 6,
  },
});
