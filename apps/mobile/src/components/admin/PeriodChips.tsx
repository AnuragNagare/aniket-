import { ScrollView, StyleSheet } from 'react-native';
import { PRESET_LABELS, type Preset } from '@worktrail/types';
import { Chip } from '../Chip';

/** Custom ranges are web-only for now. */
export type AppPreset = Exclude<Preset, 'custom'>;
export const APP_PRESETS: AppPreset[] = ['today', 'yesterday', 'this-week', 'last-week', 'this-month'];

export function PeriodChips({ value, onChange }: { value: AppPreset; onChange: (p: AppPreset) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {APP_PRESETS.map((p) => (
        <Chip key={p} label={PRESET_LABELS[p]} selected={p === value} onPress={() => onChange(p)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { gap: 8, paddingVertical: 2 } });
