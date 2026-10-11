import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { colors, fonts } from '../../theme/theme';
import { Button } from '../Button';

type Query = { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };

/** Loading, error (with retry) and content for one query, so no admin screen is ever blank. */
export function QueryGate({ query, children }: { query: Query; children: React.ReactNode }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!query.isLoading) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [query.isLoading]);

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading" color={colors.brand500} />
        {slow ? <Text style={styles.hint}>Still loading. The first request can take up to a minute while the server wakes up.</Text> : null}
      </View>
    );
  }
  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : 'Something went wrong. Try again.';
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
        <Button title="Try again" variant="secondary" onPress={() => void query.refetch()} />
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'stretch', gap: 12, paddingVertical: 32 },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500, textAlign: 'center' },
  error: { fontFamily: fonts.body, fontSize: 16, color: colors.ink900, textAlign: 'center' },
});
