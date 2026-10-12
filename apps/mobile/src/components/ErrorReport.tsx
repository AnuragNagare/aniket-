import { Share, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radius } from '../theme/theme';

/** Opens the share sheet, which has Copy, WhatsApp and so on. */
export const shareReport = (report: string) => Share.share({ message: report }).catch(() => undefined);

/** The error text and the buttons to copy it. */
export function ErrorReport({ report, onDismiss, dismissLabel }: { report: string; onDismiss: () => void; dismissLabel: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.report} selectable>
        {report}
      </Text>
      <Button title="Copy or share error" onPress={() => void shareReport(report)} />
      <Button title={dismissLabel} variant="secondary" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  report: { fontFamily: 'monospace', fontSize: 12, color: colors.ink900, backgroundColor: colors.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colors.line, padding: 12 },
});
