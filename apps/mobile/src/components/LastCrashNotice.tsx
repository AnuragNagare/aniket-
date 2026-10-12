import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { clearCrash, loadCrash } from '../debug/crash-report';
import { ErrorReport } from './ErrorReport';
import { colors, fonts } from '../theme/theme';

/** Shows the error from the last time the app crashed, once, with a button to copy it. */
export function LastCrashNotice() {
  const [report, setReport] = useState<string | null>(null);
  useEffect(() => {
    void loadCrash().then(setReport);
  }, []);
  if (!report) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>The app had a problem last time</Text>
      <ErrorReport
        report={report}
        dismissLabel="Dismiss"
        onDismiss={() => {
          void clearCrash();
          setReport(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.danger500 },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger500 },
});
