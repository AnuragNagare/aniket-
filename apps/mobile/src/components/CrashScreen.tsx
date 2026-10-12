import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { formatReport, saveCrash } from '../debug/crash-report';
import { ErrorReport } from './ErrorReport';
import { Screen } from './Screen';
import { colors, fonts } from '../theme/theme';

/** Replaces a screen that threw while drawing, so the error can be copied instead of the app closing. */
export function CrashScreen({ error, retry }: { error: Error; retry: () => void }) {
  const report = formatReport(error, 'screen error');
  useEffect(() => {
    void saveCrash(report);
  }, [report]);
  return (
    <Screen>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.sub}>Tap Copy or share error and send it to the developer.</Text>
      <ErrorReport report={report} onDismiss={retry} dismissLabel="Try again" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
});
