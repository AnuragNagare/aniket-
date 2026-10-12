import { ScrollView, StyleSheet } from 'react-native';
import { PRESET_LABELS, type Preset } from '@worktrail/types';
import { Chip } from '../Chip';

/** Custom ranges are web-only for now. */
export type AppPreset = Exclude<Preset, 'custom'>;
export const APP_PRESETS: AppPreset[] = ['today', 'yesterday', 'this-week', 'last-week', 'this-month'];

export function PeriodChips({ value, onChange }: { value: AppPreset; onChange: (p: AppPreset) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {APP_PRESETS.map((p) => (
        <Chip key={p} label={PRESET_LABELS[p]} selected={p === value} onPress={() => onChange(p)} />
      ))}
    </ScrollView>
  );
}

// flexGrow 0: inside a growing screen body a horizontal ScrollView otherwise stretches to fill the height.
const styles = StyleSheet.create({ scroll: { flexGrow: 0 }, row: { gap: 8, paddingVertical: 2 } });
