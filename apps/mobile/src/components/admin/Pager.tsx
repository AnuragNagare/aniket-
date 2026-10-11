import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme/theme';
import { Button } from '../Button';

type Props = { page: number; total: number; pageSize: number; onChange: (page: number) => void };

/** Previous / Next with "Page 2 of 5". Renders nothing when everything fits on one page. */
export function Pager({ page, total, pageSize, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <View style={styles.pager}>
      <Button title="Previous" variant="secondary" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      <Text style={styles.text}>{`Page ${page} of ${pages}`}</Text>
      <Button title="Next" variant="secondary" disabled={page >= pages} onPress={() => onChange(page + 1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { gap: 10, alignItems: 'stretch' },
  text: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink500, textAlign: 'center' },
});
