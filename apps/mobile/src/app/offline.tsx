import { Text } from 'react-native';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Screen } from '../components/Screen';
import { useAuthStore } from '../auth/auth-store';
import { colors, fonts } from '../theme/theme';

export default function OfflineScreen() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  return (
    <Screen>
      <Logo />
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 28,
          color: colors.ink900,
          marginTop: 24,
        }}
      >
        Can&apos;t reach Work Trail
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 16, color: colors.ink700 }}>
        You&apos;re still signed in. Check your mobile data or Wi-Fi, then try again.
      </Text>
      <Button title="Try again" onPress={() => void bootstrap()} />
    </Screen>
  );
}
