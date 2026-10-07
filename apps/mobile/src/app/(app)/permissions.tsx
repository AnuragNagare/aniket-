import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { requestBackgroundPermission, requestPermission } from '../../location/location';
import { colors, fonts } from '../../theme/theme';

const FOREGROUND_POINTS: Array<[string, string]> = [
  ['What', 'Your phone’s location.'],
  [
    'When',
    'Only when you tap Start work and End work. Nothing is recorded while you’re off duty.',
  ],
  ['Why', 'So your company can see where your work day began and ended.'],
  ['Who sees it', 'Your company’s admins on the Work Trail dashboard.'],
  ['How to stop', 'Tap End work. You can also turn location off in Android Settings at any time.'],
];

const BACKGROUND_POINTS: Array<[string, string]> = [
  ['Permission', 'Choose “Allow all the time” on the next screen.'],
  [
    'How it works',
    'Work Trail then records your location about every 5 minutes while you’re at work, even when the phone is locked.',
  ],
  [
    'Your privacy',
    'Nothing is recorded after you tap End work, and you’ll always see a notification while it’s on.',
  ],
];

export default function PermissionsScreen() {
  const router = useRouter();
  const { step } = useLocalSearchParams<{ step?: string }>();
  const isBackground = step === 'background';
  const [blocked, setBlocked] = useState(false);

  const allow = async () => {
    const state = isBackground ? await requestBackgroundPermission() : await requestPermission();
    if (state === 'granted') return router.back();
    setBlocked(state === 'blocked' || state === 'denied');
  };

  const points = isBackground ? BACKGROUND_POINTS : FOREGROUND_POINTS;

  return (
    <Screen>
      <Text style={styles.title}>
        {isBackground ? 'Keep recording while your screen is off' : 'How Work Trail uses your location'}
      </Text>
      {points.map(([label, body]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      ))}
      {blocked ? (
        <>
          <Notice tone="warning">
            {isBackground
              ? 'Background location is turned off for Work Trail. Open Settings, tap Permissions, then Location, and choose “Allow all the time”.'
              : 'Location is turned off for Work Trail. Open Settings, tap Permissions, then Location, and choose “Allow only while using the app”.'}
          </Notice>
          <Button title="Open settings" onPress={() => void Linking.openSettings()} />
        </>
      ) : (
        <Button
          title={isBackground ? 'Continue' : 'Allow location'}
          onPress={() => void allow()}
        />
      )}
      <Button title="Not now" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.ink900,
    marginTop: 8,
  },
  row: { gap: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink900 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink700 },
});
