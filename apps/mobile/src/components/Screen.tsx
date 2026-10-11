import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Pull-to-refresh. Only applies when the screen scrolls. */
  onRefresh?: () => void;
  refreshing?: boolean;
};

/** Page wrapper: warm canvas background, safe-area padding, optional scrolling. */
export function Screen({ children, scroll = true, style, onRefresh, refreshing = false }: Props) {
  const body = <View style={[styles.body, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand500} /> : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1, paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
});
